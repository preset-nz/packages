// pdfpage <in.pdf> <out-prefix> [height px]: every page of the PDF as <out-prefix>-<n>.png
// (from 1), white behind it, `height` pixels tall (default 2400). For an edit's end stills:
// qlmanage draws only the first page.
import AppKit
import PDFKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("pdfpage <in.pdf> <out-prefix> [height]\n".data(using: .utf8)!)
    exit(1)
}
let height = CGFloat(Double(args.count > 3 ? args[3] : "") ?? 2400)
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let box = page.bounds(for: .mediaBox)
    let scale = height / box.height
    let w = Int((box.width * scale).rounded()), h = Int(height)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ctx
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: w, height: h).fill()
    ctx.cgContext.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    let out = URL(fileURLWithPath: "\(args[2])-\(i + 1).png")
    try! rep.representation(using: .png, properties: [:])!.write(to: out)
    print(out.path)
}
