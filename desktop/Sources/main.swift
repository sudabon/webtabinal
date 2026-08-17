import AppKit
import Foundation
import UserNotifications
import WebKit

private let appName = "WebTabinal"
private let defaultPort = 8642
private let startupTimeout: TimeInterval = 15
private let probeInterval: TimeInterval = 0.15

/// WKWebView swallows Command key equivalents; forward them to the app menu so Cmd+Q quits.
private final class DesktopWebView: WKWebView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if NSApp.mainMenu?.performKeyEquivalent(with: event) == true {
            return true
        }
        return super.performKeyEquivalent(with: event)
    }
}

final class AppDelegate: NSObject,
    NSApplicationDelegate,
    WKScriptMessageHandler,
    WKScriptMessageHandlerWithReply,
    WKNavigationDelegate,
    WKUIDelegate,
    NSWindowDelegate,
    UNUserNotificationCenterDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var port = defaultPort
    private var logPath: String = ""
    private var initialLoadFinished = false
    private let userNotificationCenter = UNUserNotificationCenter.current()
    private lazy var notificationService = NativeNotificationService(
        center: SystemUserNotificationCenterClient(center: userNotificationCenter)
    )
    private var notificationBridge: NotificationBridge!
    private let notificationActivation = NotificationActivationCoordinator()

    func applicationWillFinishLaunching(_ notification: Notification) {
        setupMainMenu()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        logPath = daemonLogPath()
        do {
            port = try readConfiguredPort()
        } catch let error as ConfigPortError {
            switch error {
            case .readFailed(let path, let underlying):
                showStartupError("Failed to read config at \(path): \(underlying.localizedDescription)")
            case .parseFailed(let path):
                showStartupError("Failed to parse config at \(path). Check that config.json is valid JSON.")
            case .invalidPort(let path):
                showStartupError("Invalid port in config at \(path). port must be an integer between 1 and 65535.")
            }
            return
        } catch {
            showStartupError("Failed to read config: \(error.localizedDescription)")
            return
        }

        buildWindow()
        userNotificationCenter.delegate = self

        if !webTabinalListening(port: port) {
            do {
                try spawnDetachedDaemon()
            } catch {
                showStartupError("Failed to start daemon: \(error.localizedDescription)")
                return
            }
        }

        waitForDaemonThenLoad()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func windowWillClose(_ notification: Notification) {
        // Intentionally leave the daemon running so sessions survive window close.
    }

    // MARK: - Window / WebView

    private func buildWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1100, height: 720)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = appName
        window.delegate = self
        window.center()
        window.setFrameAutosaveName("WebTabinalMain")

        let config = WKWebViewConfiguration()
        let ucc = config.userContentController
        ucc.add(self, name: "webtabinal")
        notificationBridge = NotificationBridge(
            service: notificationService,
            expectedOrigin: NotificationBridgeOrigin(scheme: "http", host: "127.0.0.1", port: port)
        )
        ucc.addScriptMessageHandler(
            self,
            contentWorld: .page,
            name: "webtabinalNotifications"
        )
        let bootstrap = """
        window.__WEBTABINAL_DESKTOP__ = true;
        (function() {
          const originalClose = window.close.bind(window);
          window.close = function() {
            try { webkit.messageHandlers.webtabinal.postMessage('close'); } catch (e) {}
            try { originalClose(); } catch (e) {}
          };
        })();
        """
        ucc.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = DesktopWebView(frame: rect, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.contentView = webView
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(
            withTitle: "About \(appName)",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        )
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(
            withTitle: "Hide Others",
            action: #selector(NSApplication.hideOtherApplications(_:)),
            keyEquivalent: "h"
        )
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(
            withTitle: "Show All",
            action: #selector(NSApplication.unhideAllApplications(_:)),
            keyEquivalent: ""
        )
        appMenu.addItem(.separator())
        appMenu.addItem(
            withTitle: "Quit \(appName)",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editItem.submenu = editMenu
        let copyItem = editMenu.addItem(withTitle: "Copy", action: #selector(copyFromWeb(_:)), keyEquivalent: "c")
        copyItem.target = self
        let pasteItem = editMenu.addItem(withTitle: "Paste", action: #selector(pasteFromWeb(_:)), keyEquivalent: "v")
        pasteItem.target = self

        NSApp.mainMenu = mainMenu
    }

    private func showWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func waitForDaemonThenLoad() {
        let deadline = Date().addingTimeInterval(startupTimeout)
        let timer = Timer(timeInterval: probeInterval, repeats: true) { [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }
            if webTabinalListening(port: self.port) {
                timer.invalidate()
                self.showWindow()
                let url = URL(string: "http://127.0.0.1:\(self.port)/")!
                self.webView.load(URLRequest(url: url))
                return
            }
            if Date() >= deadline {
                timer.invalidate()
                self.showStartupError(
                    "Timed out waiting for the WebTabinal daemon on port \(self.port).\n\n\(self.logHint())"
                )
            }
        }
        RunLoop.main.add(timer, forMode: .common)
    }

    private func showStartupError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "WebTabinal failed to start"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "OK")
        alert.runModal()
        NSApp.terminate(nil)
    }

    private func showLoadError(failedURL: String, error: Error) {
        let message = "Failed to load \(failedURL):\n\(error.localizedDescription)\n\n\(logHint())"
        if initialLoadFinished {
            let alert = NSAlert()
            alert.messageText = "WebTabinal failed to load"
            alert.informativeText = message
            alert.alertStyle = .warning
            alert.addButton(withTitle: "OK")
            if let window {
                alert.beginSheetModal(for: window)
            } else {
                alert.runModal()
            }
            return
        }
        showStartupError(message)
    }

    private func logHint() -> String {
        "Check the logs:\n\(daemonLogPath())\n\(stdioLogPath())"
    }

    // MARK: - Daemon lifecycle

    private func readConfiguredPort() throws -> Int {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let configURL = home
            .appendingPathComponent("Library/Application Support/WebTabinal/config.json")
        guard FileManager.default.fileExists(atPath: configURL.path) else {
            return defaultPort
        }
        let data: Data
        do {
            data = try Data(contentsOf: configURL)
        } catch {
            throw ConfigPortError.readFailed(path: configURL.path, underlying: error)
        }
        return try configuredPort(from: data, path: configURL.path, defaultPort: defaultPort)
    }

    private func daemonLogPath() -> String {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/WebTabinal/daemon.log")
            .path
    }

    private func stdioLogPath() -> String {
        let dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/WebTabinal")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("daemon.stdio.log").path
    }

    private func sidecarBinaryURL() -> URL {
        if let url = Bundle.main.url(forAuxiliaryExecutable: "webtabinal-daemon") {
            return url
        }
        return Bundle.main.bundleURL
            .appendingPathComponent("Contents/MacOS/webtabinal-daemon")
    }

    /// Spawns `webtabinal serve` in a new session so Force Quit of the app does not kill it.
    private func spawnDetachedDaemon() throws {
        let binary = sidecarBinaryURL().path
        guard FileManager.default.isExecutableFile(atPath: binary) else {
            throw NSError(
                domain: "WebTabinal",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Bundled webtabinal binary not found at \(binary)\n\n\(logHint())"]
            )
        }
        let log = stdioLogPath()
        try spawnDetachedProcess(executablePath: binary, arguments: ["serve"], logPath: log)
    }

    // MARK: - Clipboard

    @objc func copyFromWeb(_ sender: Any?) {
        copySelectionToPasteboard()
    }

    @objc func pasteFromWeb(_ sender: Any?) {
        pasteFromPasteboard()
    }

    private func copySelectionToPasteboard() {
        guard webView != nil else { return }
        webView.evaluateJavaScript("window.__webtabinalClipboard && window.__webtabinalClipboard.copyText()") { result, _ in
            guard let text = result as? String, !text.isEmpty else { return }
            DispatchQueue.main.async {
                let pasteboard = NSPasteboard.general
                pasteboard.clearContents()
                pasteboard.setString(text, forType: .string)
            }
        }
    }

    private func pasteFromPasteboard() {
        guard webView != nil else { return }
        webView.evaluateJavaScript("window.__webtabinalClipboard && window.__webtabinalClipboard.focusKind()") { [weak self] result, _ in
            guard let self else { return }
            let kind = result as? String
            DispatchQueue.main.async {
                if kind == "textfield" {
                    self.pasteIntoFocusedFieldFromPasteboard()
                    return
                }
                self.pasteIntoTerminalFromPasteboard()
            }
        }
    }

    private func pasteIntoFocusedFieldFromPasteboard() {
        guard webView != nil else { return }
        guard let text = NSPasteboard.general.string(forType: .string), !text.isEmpty else { return }
        let literal = javaScriptStringLiteral(text)
        webView.evaluateJavaScript("window.__webtabinalClipboard && window.__webtabinalClipboard.insertIntoFocusedField(\(literal))")
    }

    private func pasteIntoTerminalFromPasteboard() {
        guard webView != nil else { return }
        guard let text = NSPasteboard.general.string(forType: .string), !text.isEmpty else { return }
        let literal = javaScriptStringLiteral(text)
        webView.evaluateJavaScript("window.__webtabinalClipboard && window.__webtabinalClipboard.paste(\(literal))")
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        initialLoadFinished = true
        notificationActivation.markReady { [weak self] sessionID in
            self?.deliverNotificationActivation(sessionID: sessionID)
        }
        webView.becomeFirstResponder()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failedURL = webView.url?.absoluteString ?? "http://127.0.0.1:\(port)/"
        showLoadError(failedURL: failedURL, error: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let failedURL = webView.url?.absoluteString ?? "http://127.0.0.1:\(port)/"
        showLoadError(failedURL: failedURL, error: error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if !initialLoadFinished {
            showStartupError("Web content process terminated unexpectedly.\n\n\(logHint())")
            return
        }
        let alert = NSAlert()
        alert.messageText = "WebTabinal content process terminated"
        alert.informativeText = "The web content process exited unexpectedly.\n\n\(logHint())"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Reload")
        alert.addButton(withTitle: "OK")
        guard let window else {
            if alert.runModal() == .alertFirstButtonReturn {
                webView.reload()
            }
            return
        }
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertFirstButtonReturn {
                self?.webView.reload()
            }
        }
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in
            completionHandler()
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        alert.beginSheetModal(for: window) { response in
            if response == .alertFirstButtonReturn {
                completionHandler(input.stringValue)
            } else {
                completionHandler(nil)
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "webtabinal" else { return }
        if let body = message.body as? String, body == "close" {
            DispatchQueue.main.async { [weak self] in
                self?.window.performClose(nil)
            }
            return
        }
        if let body = message.body as? [String: Any], body["t"] as? String == "clipboardRead" {
            DispatchQueue.main.async { [weak self] in
                self?.pasteFromPasteboard()
            }
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.name == "webtabinalNotifications" else {
            replyHandler(nil, "unknown script message handler")
            return
        }
        let origin = message.frameInfo.securityOrigin
        notificationBridge.handle(
            message.body,
            isMainFrame: message.frameInfo.isMainFrame,
            scheme: origin.protocol,
            host: origin.host,
            port: origin.port,
            reply: replyHandler
        )
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler(foregroundNotificationPresentationOptions())
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        guard let sessionID = response.notification.request.content.userInfo["sid"] as? String,
              !sessionID.isEmpty else {
            completionHandler()
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                completionHandler()
                return
            }
            self.showWindow()
            self.notificationActivation.receive(sessionID: sessionID) { [weak self] pendingSessionID in
                self?.deliverNotificationActivation(sessionID: pendingSessionID)
            }
            completionHandler()
        }
    }

    private func deliverNotificationActivation(sessionID: String) {
        guard webView != nil else { return }
        webView.evaluateJavaScript(notificationActivationJavaScript(sessionID: sessionID))
    }
}

autoreleasepool {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
