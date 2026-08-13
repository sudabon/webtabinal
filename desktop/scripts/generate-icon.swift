#!/usr/bin/env swift
import AppKit
import Foundation
import ImageIO

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

let representations: [(pixels: Int, dpi: Int)] = [
    (16, 72),
    (32, 144),
    (32, 72),
    (64, 144),
    (128, 72),
    (256, 144),
    (256, 72),
    (512, 144),
    (512, 72),
    (1024, 144),
]

func renderIcon(size: Int) throws -> CGImage {
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
    guard let cgImage = rep.cgImage else {
        throw NSError(domain: "WebTabinal", code: 1, userInfo: [NSLocalizedDescriptionKey: "icon render failed"])
    }
    return cgImage
}

guard let destination = CGImageDestinationCreateWithURL(
    icnsURL as CFURL,
    "com.apple.icns" as CFString,
    representations.count,
    nil
) else {
    fputs("failed to create ICNS destination: \(icnsURL.path)\n", stderr)
    exit(1)
}
for representation in representations {
    let properties = [
        kCGImagePropertyDPIWidth: representation.dpi,
        kCGImagePropertyDPIHeight: representation.dpi,
    ] as CFDictionary
    CGImageDestinationAddImage(
        destination,
        try renderIcon(size: representation.pixels),
        properties
    )
}
guard CGImageDestinationFinalize(destination) else {
    fputs("failed to write ICNS: \(icnsURL.path)\n", stderr)
    exit(1)
}

print("wrote \(icnsURL.path)")
