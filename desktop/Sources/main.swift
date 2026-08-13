import AppKit
import Foundation
import WebKit

private let appName = "WebTabinal"
private let defaultPort = 8642
private let startupTimeout: TimeInterval = 15
private let probeInterval: TimeInterval = 0.15

private enum ConfigPortError: Error {
    case readFailed(path: String, underlying: Error)
    case parseFailed(path: String)
    case invalidPort(path: String)
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var port = defaultPort
    private var logPath: String = ""

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

        if !isListening(port: port) {
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

        webView = WKWebView(frame: rect, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.contentView = webView
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
            if self.isListening(port: self.port) {
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
        showStartupError(
            "Failed to load \(failedURL):\n\(error.localizedDescription)\n\n\(logHint())"
        )
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
        let json: [String: Any]
        do {
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw ConfigPortError.parseFailed(path: configURL.path)
            }
            json = object
        } catch let error as ConfigPortError {
            throw error
        } catch {
            throw ConfigPortError.parseFailed(path: configURL.path)
        }
        guard let value = json["port"] as? Int, value > 0, value <= 65535 else {
            throw ConfigPortError.invalidPort(path: configURL.path)
        }
        return value
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

    private func isListening(port: Int) -> Bool {
        var hints = addrinfo(
            ai_flags: AI_NUMERICHOST,
            ai_family: AF_INET,
            ai_socktype: SOCK_STREAM,
            ai_protocol: IPPROTO_TCP,
            ai_addrlen: 0,
            ai_canonname: nil,
            ai_addr: nil,
            ai_next: nil
        )
        var result: UnsafeMutablePointer<addrinfo>?
        let host = "127.0.0.1"
        let portStr = String(port)
        guard getaddrinfo(host, portStr, &hints, &result) == 0, let info = result else {
            return false
        }
        defer { freeaddrinfo(info) }

        let fd = socket(info.pointee.ai_family, info.pointee.ai_socktype, info.pointee.ai_protocol)
        guard fd >= 0 else { return false }
        defer { close(fd) }

        var timeout = timeval(tv_sec: 0, tv_usec: 200_000)
        _ = setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        _ = setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))

        let connected = connect(fd, info.pointee.ai_addr, info.pointee.ai_addrlen) == 0
        return connected
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
        // python3 start_new_session=True calls setsid(); the daemon outlives the .app.
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        let script = """
        import subprocess
        log = open(\(pythonStringLiteral(log)), "a")
        subprocess.Popen(
            [\(pythonStringLiteral(binary)), "serve"],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
        """
        process.arguments = ["-c", script]
        try process.run()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            var detail = String(data: stderrData, encoding: .utf8) ?? ""
            if detail.isEmpty {
                detail = String(data: stdoutData, encoding: .utf8) ?? ""
            }
            detail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
            var message = "Failed to spawn daemon (exit \(process.terminationStatus))"
            if !detail.isEmpty {
                message += ":\n\(detail)"
            }
            message += "\n\n\(logHint())"
            throw NSError(
                domain: "WebTabinal",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
    }

    private func pythonStringLiteral(_ value: String) -> String {
        "\"" + value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            + "\""
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failedURL = webView.url?.absoluteString ?? "http://127.0.0.1:\(port)/"
        showLoadError(failedURL: failedURL, error: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let failedURL = webView.url?.absoluteString ?? "http://127.0.0.1:\(port)/"
        showLoadError(failedURL: failedURL, error: error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showStartupError("Web content process terminated unexpectedly.\n\n\(logHint())")
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
        }
    }
}

autoreleasepool {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
