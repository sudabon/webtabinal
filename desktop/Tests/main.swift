import Darwin
import Foundation
import UserNotifications

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

private struct FakeNotificationError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
}

private final class FakeUserNotificationCenter: UserNotificationCenterClient {
    var status: UNAuthorizationStatus = .notDetermined
    var statusAfterRequest: UNAuthorizationStatus?
    var authorizationError: Error?
    var addError: Error?
    var requestedOptions: [UNAuthorizationOptions] = []
    var addedRequests: [UNNotificationRequest] = []

    func getAuthorizationStatus(completion: @escaping (UNAuthorizationStatus) -> Void) {
        completion(status)
    }

    func requestAuthorization(
        options: UNAuthorizationOptions,
        completion: @escaping (Bool, Error?) -> Void
    ) {
        requestedOptions.append(options)
        if authorizationError == nil, let statusAfterRequest {
            status = statusAfterRequest
        }
        completion(status == .authorized, authorizationError)
    }

    func add(_ request: UNNotificationRequest, completion: @escaping (Error?) -> Void) {
        addedRequests.append(request)
        completion(addError)
    }
}

private final class FakeNativeNotificationService: NativeNotificationServicing {
    var permission: DesktopNotificationPermission = .granted
    var requestResult: Result<DesktopNotificationPermission, Error> = .success(.granted)
    var showResult: Result<Void, Error> = .success(())
    var getPermissionCalls = 0
    var requestPermissionCalls = 0
    var shown: [(sessionID: String, title: String, body: String)] = []

    func getPermission(completion: @escaping (DesktopNotificationPermission) -> Void) {
        getPermissionCalls += 1
        completion(permission)
    }

    func requestPermission(
        completion: @escaping (Result<DesktopNotificationPermission, Error>) -> Void
    ) {
        requestPermissionCalls += 1
        completion(requestResult)
    }

    func show(
        sessionID: String,
        title: String,
        body: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        shown.append((sessionID, title, body))
        completion(showResult)
    }
}

private func testNotificationAuthorizationStatusMapping() throws {
    let cases: [(UNAuthorizationStatus, DesktopNotificationPermission)] = [
        (.notDetermined, .default),
        (.denied, .denied),
        (.authorized, .granted),
        (.provisional, .granted),
        (UNAuthorizationStatus(rawValue: 4)!, .granted),
    ]
    for (status, expected) in cases {
        try expect(
            desktopNotificationPermission(for: status) == expected,
            "authorization status \(status.rawValue) mapped incorrectly"
        )
    }
}

private func testNotificationAuthorizationRequestsAlertAndReturnsUpdatedStatus() throws {
    let center = FakeUserNotificationCenter()
    center.statusAfterRequest = .authorized
    let service = NativeNotificationService(center: center)
    var result: Result<DesktopNotificationPermission, Error>?
    service.requestPermission { result = $0 }

    try expect(center.requestedOptions.count == 1, "authorization must be requested once")
    try expect(center.requestedOptions[0] == [.alert], "authorization must request alerts only")
    guard case .success(let permission) = result else {
        throw TestFailure.failed("authorization did not return success")
    }
    try expect(permission == .granted, "authorization must return the updated status")
}

private func testNotificationRequestContentAndPermissionGate() throws {
    let center = FakeUserNotificationCenter()
    center.status = .authorized
    var sequence = 0
    let service = NativeNotificationService(center: center) {
        sequence += 1
        return "webtabinal-test-\(sequence)"
    }

    var firstResult: Result<Void, Error>?
    service.show(sessionID: "session-1", title: "Build complete", body: "project · 4s") {
        firstResult = $0
    }
    var secondResult: Result<Void, Error>?
    service.show(sessionID: "session-2", title: "Approval needed", body: "Codex is waiting") {
        secondResult = $0
    }

    guard case .success = firstResult, case .success = secondResult else {
        throw TestFailure.failed("authorized notifications must be scheduled successfully")
    }
    try expect(center.addedRequests.count == 2, "two notifications must create two requests")
    try expect(
        center.addedRequests[0].identifier != center.addedRequests[1].identifier,
        "notification identifiers must be unique"
    )
    let request = center.addedRequests[0]
    try expect(request.identifier == "webtabinal-test-1", "request identifier was not preserved")
    try expect(request.content.title == "Build complete", "notification title was not preserved")
    try expect(request.content.body == "project · 4s", "notification body was not preserved")
    try expect(request.content.userInfo["sid"] as? String == "session-1", "session metadata was not preserved")
    try expect(request.content.sound == nil, "notifications must not request sound")
    try expect(request.trigger == nil, "notifications must be delivered immediately")

    center.status = .denied
    var deniedResult: Result<Void, Error>?
    service.show(sessionID: "session-3", title: "Ignored", body: "Denied") {
        deniedResult = $0
    }
    guard case .failure(let error) = deniedResult else {
        throw TestFailure.failed("denied permission must reject scheduling")
    }
    try expect(error.localizedDescription == "notification permission is denied", "denied error must be deterministic")
    try expect(center.addedRequests.count == 2, "denied permission must not schedule a request")
}

private func bridgeReply(
    _ bridge: NotificationBridge,
    message: Any,
    isMainFrame: Bool = true,
    scheme: String = "http",
    host: String = "127.0.0.1",
    port: Int = 8642
) -> (value: Any?, error: String?) {
    var value: Any?
    var error: String?
    bridge.handle(
        message,
        isMainFrame: isMainFrame,
        scheme: scheme,
        host: host,
        port: port
    ) {
        value = $0
        error = $1
    }
    return (value, error)
}

private func testNotificationBridgeValidationAndOperations() throws {
    let service = FakeNativeNotificationService()
    let bridge = NotificationBridge(
        service: service,
        expectedOrigin: NotificationBridgeOrigin(scheme: "http", host: "127.0.0.1", port: 8642)
    )

    let subframe = bridgeReply(bridge, message: ["operation": "getPermission"], isMainFrame: false)
    try expect(subframe.error == "notification bridge rejected a non-main-frame message", "subframe error changed")
    let remote = bridgeReply(bridge, message: ["operation": "getPermission"], host: "example.com")
    try expect(remote.error == "notification bridge rejected an untrusted origin", "remote origin must be rejected")
    let wrongPort = bridgeReply(bridge, message: ["operation": "getPermission"], port: 9999)
    try expect(wrongPort.error == "notification bridge rejected an untrusted origin", "wrong port must be rejected")
    let nonObject = bridgeReply(bridge, message: "getPermission")
    try expect(nonObject.error == "notification bridge expected an object message", "non-object must be rejected")
    let unknown = bridgeReply(bridge, message: ["operation": "unknown"])
    try expect(unknown.error == "notification bridge received an invalid operation", "unknown operation must be rejected")
    let malformed = bridgeReply(bridge, message: [
        "operation": "show",
        "sid": 42,
        "title": "Title",
        "body": "Body",
    ])
    try expect(malformed.error?.contains("requires non-empty string") == true, "malformed show must be rejected")
    try expect(service.getPermissionCalls == 0, "rejected messages must not query permission")
    try expect(service.shown.isEmpty, "rejected messages must not schedule notifications")

    service.permission = .granted
    let permission = bridgeReply(bridge, message: ["operation": "getPermission"])
    try expect(permission.value as? String == "granted" && permission.error == nil, "getPermission reply changed")

    service.requestResult = .success(.denied)
    let requested = bridgeReply(bridge, message: ["operation": "requestPermission"])
    try expect(requested.value as? String == "denied" && requested.error == nil, "requestPermission reply changed")

    let shown = bridgeReply(bridge, message: [
        "operation": "show",
        "sid": "session-1",
        "title": "Approval",
        "body": "Codex is waiting",
    ])
    try expect(shown.value as? Bool == true && shown.error == nil, "show success reply changed")
    try expect(service.shown.count == 1, "valid show must invoke the service once")
    try expect(service.shown[0].sessionID == "session-1", "show session ID changed")

    service.showResult = .failure(FakeNotificationError(message: "schedule failed"))
    let failed = bridgeReply(bridge, message: [
        "operation": "show",
        "sid": "session-2",
        "title": "Approval",
        "body": "Codex is waiting",
    ])
    try expect(failed.value == nil && failed.error == "schedule failed", "show error reply must be deterministic")
}

private func testForegroundPresentationAndPendingActivation() throws {
    let options = foregroundNotificationPresentationOptions()
    try expect(options.contains(.banner), "foreground notifications must include banner presentation")
    try expect(options.contains(.list), "foreground notifications must include list presentation")
    try expect(!options.contains(.sound), "foreground notifications must not include sound")

    let coordinator = NotificationActivationCoordinator()
    var delivered: [String] = []
    coordinator.receive(sessionID: "first") { delivered.append($0) }
    coordinator.receive(sessionID: "last") { delivered.append($0) }
    try expect(delivered.isEmpty, "activation must wait until navigation is ready")
    try expect(coordinator.pendingSessionID == "last", "only the final pending activation must be retained")

    coordinator.markReady { delivered.append($0) }
    coordinator.markReady { delivered.append($0) }
    try expect(delivered == ["last"], "pending activation must be delivered exactly once")
    coordinator.receive(sessionID: "loaded") { delivered.append($0) }
    try expect(delivered == ["last", "loaded"], "loaded activation must be delivered immediately")

    let script = notificationActivationJavaScript(sessionID: "session\"\n1")
    try expect(script.contains("webtabinal-native-notification-activated"), "activation event name changed")
    try expect(script.contains("session\\\"\\n1"), "activation session ID must be JSON escaped")
}

try testConfiguredPortDefaultsMissingAndZero()
try testConfiguredPortValidatesExplicitValues()
try testProbeRequiresWebTabinalSignature()
try testDetachedSpawnCreatesSessionAndCapturesLogs()
try testJavaScriptStringLiteralEscapesQuotesAndNewlines()
try testNotificationAuthorizationStatusMapping()
try testNotificationAuthorizationRequestsAlertAndReturnsUpdatedStatus()
try testNotificationRequestContentAndPermissionGate()
try testNotificationBridgeValidationAndOperations()
try testForegroundPresentationAndPendingActivation()
print("desktop support tests passed")
