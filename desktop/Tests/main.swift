import Darwin
import Foundation

private enum TestFailure: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case .failed(let message):
            return message
        }
    }
}

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw TestFailure.failed(message)
    }
}

private func testConfiguredPortDefaultsMissingAndZero() throws {
    let missing = Data(#"{"shell":"/bin/zsh"}"#.utf8)
    let zero = Data(#"{"port":0}"#.utf8)
    let missingPort = try configuredPort(from: missing, path: "config.json", defaultPort: 8642)
    let zeroPort = try configuredPort(from: zero, path: "config.json", defaultPort: 8642)
    try expect(missingPort == 8642, "missing port must use default")
    try expect(zeroPort == 8642, "zero port must use default")
}

private func testConfiguredPortValidatesExplicitValues() throws {
    let valid = Data(#"{"port":9000}"#.utf8)
    let validPort = try configuredPort(from: valid, path: "config.json", defaultPort: 8642)
    try expect(validPort == 9000, "valid port must be preserved")

    for json in [#"{"port":-1}"#, #"{"port":65536}"#, #"{"port":"8642"}"#, #"{"port":true}"#] {
        do {
            _ = try configuredPort(from: Data(json.utf8), path: "config.json", defaultPort: 8642)
            throw TestFailure.failed("invalid port was accepted: \(json)")
        } catch is ConfigPortError {
            continue
        }
    }
}

private func testProbeRequiresWebTabinalSignature() throws {
    let valid = Data((
        "HTTP/1.1 401 Unauthorized\r\n" +
        "X-Frame-Options: DENY\r\n" +
        "X-Content-Type-Options: nosniff\r\n" +
        "Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'\r\n" +
        "Content-Length: 13\r\n" +
        "\r\n" +
        "unauthorized\n"
    ).utf8)
    try expect(isWebTabinalProbeResponse(valid), "valid WebTabinal response must be accepted")

    let unrelated = Data("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".utf8)
    try expect(!isWebTabinalProbeResponse(unrelated), "unrelated HTTP response must be rejected")

    let redirect = Data("HTTP/1.1 302 Found\r\nLocation: http://example.com/\r\nContent-Length: 0\r\n\r\n".utf8)
    try expect(!isWebTabinalProbeResponse(redirect), "redirect response must be rejected")
}

private func testDetachedSpawnCreatesSessionAndCapturesLogs() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("WebTabinalDesktopTests-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let logPath = directory.appendingPathComponent("child.log").path
    let pid = try spawnDetachedProcess(
        executablePath: "/bin/sh",
        arguments: ["-c", "printf stdout; printf stderr >&2; sleep 5"],
        logPath: logPath
    )
    defer {
        _ = kill(pid, SIGTERM)
        var status: Int32 = 0
        _ = waitpid(pid, &status, 0)
    }

    try expect(getsid(pid) == pid, "spawned process must lead a detached session")
    let deadline = Date().addingTimeInterval(2)
    var output = ""
    repeat {
        if let data = FileManager.default.contents(atPath: logPath) {
            output = String(data: data, encoding: .utf8) ?? ""
        }
        if output.contains("stdout") && output.contains("stderr") {
            break
        }
        usleep(10_000)
    } while Date() < deadline
    try expect(output.contains("stdout"), "stdout must be written to the daemon log")
    try expect(output.contains("stderr"), "stderr must be written to the daemon log")
}

private func testJavaScriptStringLiteralEscapesQuotesAndNewlines() throws {
    try expect(javaScriptStringLiteral("hello") == "\"hello\"", "plain text must be quoted")
    try expect(javaScriptStringLiteral("a\"b") == "\"a\\\"b\"", "quotes must be escaped")
    try expect(javaScriptStringLiteral("a\nb") == "\"a\\nb\"", "newlines must be escaped")
    try expect(javaScriptStringLiteral("") == "\"\"", "empty string must be quoted")
}

try testConfiguredPortDefaultsMissingAndZero()
try testConfiguredPortValidatesExplicitValues()
try testProbeRequiresWebTabinalSignature()
try testDetachedSpawnCreatesSessionAndCapturesLogs()
try testJavaScriptStringLiteralEscapesQuotesAndNewlines()
print("desktop support tests passed")
