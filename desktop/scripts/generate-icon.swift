#!/usr/bin/env swift
import AppKit
import Foundation

// Usage: generate-icon.swift <icon.svg> <out.icns>
guard CommandLine.arguments.count >= 3 else {
    fputs("usage: generate-icon.swift <icon.svg> <out.icns>\n", stderr)
    exit(2)
}

let svgURL = URL(fileURLWithPath: CommandLine.arguments[1])
let icnsURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let image = NSImage(contentsOf: svgURL), image.isValid else {
    fputs("failed to load SVG: \(svgURL.path)\n", stderr)
    exit(1)
}

let sizes: [Int] = [16, 32, 64, 128, 256, 512, 1024]
let work = FileManager.default.temporaryDirectory
    .appendingPathComponent("WebTabinalIcon-\(UUID().uuidString)")
let iconset = work.appendingPathComponent("AppIcon.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: work) }

func writePNG(size: Int, name: String) throws {
    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = NSSize(width: size, height: size)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSColor.clear.setFill()
    rect.fill()
    image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "WebTabinal", code: 1, userInfo: [NSLocalizedDescriptionKey: "PNG encode failed"])
    }
    try data.write(to: iconset.appendingPathComponent(name))
}

for size in sizes {
    try writePNG(size: size, name: "icon_\(size)x\(size).png")
    if size <= 512 {
        try writePNG(size: size * 2, name: "icon_\(size)x\(size)@2x.png")
    }
}

let proc = Process()
proc.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
proc.arguments = ["-c", "icns", iconset.path, "-o", icnsURL.path]
try proc.run()
proc.waitUntilExit()
if proc.terminationStatus != 0 {
    fputs("iconutil failed\n", stderr)
    exit(Int32(proc.terminationStatus))
}

print("wrote \(icnsURL.path)")
