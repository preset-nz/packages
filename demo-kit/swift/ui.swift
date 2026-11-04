// ui move x y | click x y | dclick x y | drag x1 y1 x2 y2 [ms] | type "text" | key <code> [cmd|shift|opt...]
// | hold <code> <ms> (a key held down for a while) | scroll x y dy [steps] (the wheel at x y,
// dy points down in total, in steps; a panel scrolls under the pointer) | stroke <ms> x1 y1 x2 y2 …
// (one drag through every point on a smooth curve, at an even speed that eases in and out:
// a hand's stroke, not a plotter's) | pos
import Foundation
import CoreGraphics

let a = CommandLine.arguments
let src = CGEventSource(stateID: .hidSystemState)
func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap) }
func mouse(_ t: CGEventType, _ p: CGPoint, clicks: Int64 = 1) {
    let e = CGEvent(mouseEventSource: src, mouseType: t, mouseCursorPosition: p, mouseButton: .left)
    e?.setIntegerValueField(.mouseEventClickState, value: clicks)
    post(e)
}
func glide(from: CGPoint, to: CGPoint, ms: Double, type: CGEventType) {
    let steps = max(2, Int(ms / 8))
    for i in 1...steps {
        let f = Double(i) / Double(steps)
        let s = f * f * (3 - 2 * f)
        mouse(type, CGPoint(x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s))
        usleep(useconds_t(ms * 1000 / Double(steps)))
    }
}
func here() -> CGPoint { CGEvent(source: nil)?.location ?? .zero }
func pt(_ i: Int) -> CGPoint { CGPoint(x: Double(a[i])!, y: Double(a[i + 1])!) }
switch a[1] {
case "pos": let p = here(); print(Int(p.x), Int(p.y))
case "move": glide(from: here(), to: pt(2), ms: 400, type: .mouseMoved)
case "click", "dclick":
    let p = pt(2); glide(from: here(), to: p, ms: 400, type: .mouseMoved)
    let n: Int64 = a[1] == "dclick" ? 2 : 1
    for c in 1...n { mouse(.leftMouseDown, p, clicks: c); usleep(30000); mouse(.leftMouseUp, p, clicks: c); usleep(60000) }
case "drag":
    let p = pt(2), q = pt(4); let ms = a.count > 6 ? Double(a[6])! : 900
    glide(from: here(), to: p, ms: 400, type: .mouseMoved)
    mouse(.leftMouseDown, p); usleep(80000)
    glide(from: p, to: q, ms: ms, type: .leftMouseDragged)
    usleep(80000); mouse(.leftMouseUp, q)
case "stroke":
    // Catmull-Rom through the points, sampled densely, then walked at an even speed along its
    // length with the whole stroke eased in and out.
    let ms = Double(a[2])!
    var ps: [CGPoint] = []
    var i = 3
    while i + 1 < a.count { ps.append(CGPoint(x: Double(a[i])!, y: Double(a[i + 1])!)); i += 2 }
    guard let first = ps.first else { break }
    var curve: [CGPoint] = [first]
    if ps.count > 1 {
        for k in 0..<(ps.count - 1) {
            let p0 = ps[max(k - 1, 0)], p1 = ps[k], p2 = ps[k + 1], p3 = ps[min(k + 2, ps.count - 1)]
            for s in 1...16 {
                let t = Double(s) / 16, t2 = t * t, t3 = t2 * t
                func c(_ a: Double, _ b: Double, _ c: Double, _ d: Double) -> Double {
                    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
                }
                curve.append(CGPoint(x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y)))
            }
        }
    }
    if curve.count < 2 { curve.append(first) }
    var lens: [Double] = [0]
    for k in 1..<curve.count { lens.append(lens[k - 1] + hypot(curve[k].x - curve[k - 1].x, curve[k].y - curve[k - 1].y)) }
    let total = max(lens.last!, 1)
    glide(from: here(), to: first, ms: 350, type: .mouseMoved)
    mouse(.leftMouseDown, first); usleep(60000)
    let steps = max(2, Int(ms / 8))
    var j = 0
    for n in 1...steps {
        let f = Double(n) / Double(steps)
        let d = f * f * (3 - 2 * f) * total
        while j < lens.count - 2 && lens[j + 1] < d { j += 1 }
        let span = max(lens[j + 1] - lens[j], 0.0001), u = min(max((d - lens[j]) / span, 0), 1)
        let q = CGPoint(x: curve[j].x + (curve[j + 1].x - curve[j].x) * u, y: curve[j].y + (curve[j + 1].y - curve[j].y) * u)
        mouse(.leftMouseDragged, q)
        usleep(useconds_t(ms * 1000 / Double(steps)))
    }
    usleep(60000); mouse(.leftMouseUp, curve.last!)
case "type":
    for ch in a[2].utf16 {
        var c = ch
        let d = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
        d?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c); post(d)
        let u = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
        u?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c); post(u)
        usleep(45000)
    }
case "key":
    var flags: CGEventFlags = []
    for m in a.dropFirst(3) {
        switch m { case "cmd": flags.insert(.maskCommand); case "shift": flags.insert(.maskShift)
        case "opt": flags.insert(.maskAlternate); case "ctrl": flags.insert(.maskControl); default: break }
    }
    let code = CGKeyCode(a[2])!
    let d = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: true); d?.flags = flags; post(d)
    let u = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: false); u?.flags = flags; post(u)
case "hold":
    let code = CGKeyCode(a[2])!
    post(CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: true))
    usleep(useconds_t(Double(a[3])! * 1000))
    post(CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: false))
case "scroll":
    let p = pt(2); glide(from: here(), to: p, ms: 400, type: .mouseMoved)
    let total = Double(a[4])!, steps = a.count > 5 ? Int(a[5])! : 12
    for _ in 0..<steps {
        let e = CGEvent(scrollWheelEvent2Source: src, units: .pixel, wheelCount: 1,
                        wheel1: Int32(-(total / Double(steps)).rounded()), wheel2: 0, wheel3: 0)
        e?.location = p; post(e); usleep(16000)
    }
default: print("unknown")
}
