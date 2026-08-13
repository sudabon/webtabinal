import Darwin
import Foundation

enum ConfigPortError: Error {
    case readFailed(path: String, underlying: Error)
    case parseFailed(path: String)
    case invalidPort(path: String)
}

private let webTabinalContentSecurityPolicy =
    "default-src 'self'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'"

func configuredPort(from data: Data, path: String, defaultPort: Int) throws -> Int {
    let json: [String: Any]
    do {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ConfigPortError.parseFailed(path: path)
        }
        json = object
    } catch let error as ConfigPortError {
        throw error
    } catch {
        throw ConfigPortError.parseFailed(path: path)
    }

    guard let rawValue = json["port"] else {
        return defaultPort
    }
    if let number = rawValue as? NSNumber,
       CFGetTypeID(number) == CFBooleanGetTypeID() {
        throw ConfigPortError.invalidPort(path: path)
    }
    guard let value = rawValue as? Int else {
        throw ConfigPortError.invalidPort(path: path)
    }
    if value == 0 {
        return defaultPort
    }
    guard value > 0, value <= 65535 else {
        throw ConfigPortError.invalidPort(path: path)
    }
    return value
}

func isWebTabinalProbeResponse(_ data: Data) -> Bool {
    guard let response = String(data: data, encoding: .utf8),
          let separator = response.range(of: "\r\n\r\n") else {
        return false
    }
    let head = response[..<separator.lowerBound]
    let body = response[separator.upperBound...]
    let lines = head.components(separatedBy: "\r\n")
    guard let statusLine = lines.first else { return false }
    let statusParts = statusLine.split(separator: " ", maxSplits: 2)
    guard statusParts.count >= 2, statusParts[1] == "401" else { return false }

    var headers: [String: String] = [:]
    for line in lines.dropFirst() {
        guard let colon = line.firstIndex(of: ":") else { continue }
        let name = line[..<colon].lowercased()
        let value = line[line.index(after: colon)...]
            .trimmingCharacters(in: .whitespaces)
        headers[name] = value
    }
    return headers["x-frame-options"] == "DENY" &&
        headers["x-content-type-options"] == "nosniff" &&
        headers["content-security-policy"] == webTabinalContentSecurityPolicy &&
        body == "unauthorized\n"
}

func webTabinalListening(port: Int) -> Bool {
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
    let portString = String(port)
    guard getaddrinfo(host, portString, &hints, &result) == 0, let info = result else {
        return false
    }
    defer { freeaddrinfo(info) }

    let fd = socket(info.pointee.ai_family, info.pointee.ai_socktype, info.pointee.ai_protocol)
    guard fd >= 0 else { return false }
    defer { close(fd) }

    var noSigPipe: Int32 = 1
    guard setsockopt(
        fd,
        SOL_SOCKET,
        SO_NOSIGPIPE,
        &noSigPipe,
        socklen_t(MemoryLayout<Int32>.size)
    ) == 0 else {
        return false
    }
    var timeout = timeval(tv_sec: 0, tv_usec: 300_000)
    _ = setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    _ = setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    guard connect(fd, info.pointee.ai_addr, info.pointee.ai_addrlen) == 0 else {
        return false
    }

    let request = "GET /api/config HTTP/1.1\r\nHost: 127.0.0.1:\(port)\r\nConnection: close\r\n\r\n"
    let requestBytes = Array(request.utf8)
    let sentAll = requestBytes.withUnsafeBytes { bytes -> Bool in
        guard let baseAddress = bytes.baseAddress else { return false }
        var sent = 0
        while sent < bytes.count {
            let count = Darwin.send(fd, baseAddress.advanced(by: sent), bytes.count - sent, 0)
            if count <= 0 { return false }
            sent += count
        }
        return true
    }
    guard sentAll else { return false }

    var response = Data()
    var buffer = [UInt8](repeating: 0, count: 1024)
    while response.count < 8 * 1024 {
        let count = Darwin.recv(fd, &buffer, min(buffer.count, 8 * 1024 - response.count), 0)
        if count <= 0 { break }
        response.append(contentsOf: buffer.prefix(Int(count)))
    }
    return isWebTabinalProbeResponse(response)
}

private struct DetachedProcessError: LocalizedError {
    let operation: String
    let code: Int32

    var errorDescription: String? {
        "\(operation) failed: \(String(cString: strerror(code)))"
    }
}

@discardableResult
func spawnDetachedProcess(executablePath: String, arguments: [String], logPath: String) throws -> pid_t {
    let logFD = Darwin.open(logPath, O_WRONLY | O_CREAT | O_APPEND, mode_t(0o644))
    guard logFD >= 0 else {
        throw DetachedProcessError(operation: "open \(logPath)", code: errno)
    }
    defer { close(logFD) }

    var fileActions: posix_spawn_file_actions_t?
    var code = posix_spawn_file_actions_init(&fileActions)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn_file_actions_init", code: code)
    }
    defer { posix_spawn_file_actions_destroy(&fileActions) }

    code = posix_spawn_file_actions_addopen(&fileActions, STDIN_FILENO, "/dev/null", O_RDONLY, 0)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn_file_actions_addopen", code: code)
    }
    code = posix_spawn_file_actions_adddup2(&fileActions, logFD, STDOUT_FILENO)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn_file_actions_adddup2 stdout", code: code)
    }
    code = posix_spawn_file_actions_adddup2(&fileActions, logFD, STDERR_FILENO)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn_file_actions_adddup2 stderr", code: code)
    }
    code = posix_spawn_file_actions_addclose(&fileActions, logFD)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn_file_actions_addclose", code: code)
    }

    var attributes: posix_spawnattr_t?
    code = posix_spawnattr_init(&attributes)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawnattr_init", code: code)
    }
    defer { posix_spawnattr_destroy(&attributes) }
    let flags = Int16(POSIX_SPAWN_SETSID | POSIX_SPAWN_CLOEXEC_DEFAULT)
    code = posix_spawnattr_setflags(&attributes, flags)
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawnattr_setflags", code: code)
    }

    var argv: [UnsafeMutablePointer<CChar>?] = ([executablePath] + arguments).map { strdup($0) }
    argv.append(nil)
    defer {
        for case let argument? in argv {
            free(argument)
        }
    }
    var pid: pid_t = 0
    code = argv.withUnsafeMutableBufferPointer { buffer in
        posix_spawn(&pid, executablePath, &fileActions, &attributes, buffer.baseAddress, environ)
    }
    guard code == 0 else {
        throw DetachedProcessError(operation: "posix_spawn \(executablePath)", code: code)
    }
    return pid
}
