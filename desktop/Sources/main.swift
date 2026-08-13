import AppKit
import Foundation
import WebKit

private let appName = "WebTabinal"
private let defaultPort = 8642
private let startupTimeout: TimeInterval = 15
private let probeInterval: TimeInterval = 0.15

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var port = defaultPort
    private var logPath: String = ""

    func applicationDidFinishLaunching(_ notification: Notification) {
        port = readConfiguredPort()
        logPath = daemonLogPath()
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
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func waitForDaemonThenLoad() {
        let deadline = Date().addingTimeInterval(startupTimeout)
        Timer.scheduledTimer(withTimeInterval: probeInterval, repeats: true) { [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }
            if self.isListening(port: self.port) {
                timer.invalidate()
                let url = URL(string: "http://127.0.0.1:\(self.port)/")!
                self.webView.load(URLRequest(url: url))
                return
            }
            if Date() >= deadline {
                timer.invalidate()
                self.showStartupError(
                    "Timed out waiting for the WebTabinal daemon on port \(self.port).\n\nCheck the log:\n\(self.logPath)"
                )
            }
        }
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

    // MARK: - Daemon lifecycle

    private func readConfiguredPort() -> Int {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let configURL = home
            .appendingPathComponent("Library/Application Support/WebTabinal/config.json")
        guard let data = try? Data(contentsOf: configURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = json["port"] as? Int,
              value > 0, value <= 65535
        else {
            return defaultPort
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
                userInfo: [NSLocalizedDescriptionKey: "Bundled webtabinal binary not found at \(binary)"]
            )
        }
        let log = stdioLogPath()
        // python3 start_new_session=True calls setsid(); the daemon outlives the .app.
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
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
            throw NSError(
                domain: "WebTabinal",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: "Failed to spawn daemon (exit \(process.terminationStatus))"]
            )
        }
    }

    private func pythonStringLiteral(_ value: String) -> String {
        "\"" + value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            + "\""
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
