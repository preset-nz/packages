import { type Curve, clamp } from "@preset.nz/math"

import type { CurveConstraint } from "./curve-edits"

/** An ADSR envelope's four controls. Times are in the curve's x units; sustain is a level, 0..1. */
export interface Adsr {
  attack: number
  decay: number
  sustain: number
  release: number
}

/**
 * The curve an ADSR draws: start at rest, peak, sustain level, end at rest, with the sustain
 * mark on the third point. Shard's sliders and the editor both write these four points.
 */
export function adsrCurve({ attack, decay, sustain, release }: Adsr): Curve {
  const a = Math.max(0, attack)
  const d = Math.max(0, decay)
  const r = Math.max(0, release)
  const s = clamp(sustain, 0, 1)
  return {
    points: [
      { x: 0, y: 0, basis: "linear" },
      { x: a, y: 1, basis: "linear" },
      { x: a + d, y: s, basis: "linear" },
      { x: a + d + r, y: 0, basis: "linear" },
    ],
    sustain: 2,
  }
}

/** The ADSR a curve draws, or `null` when it no longer has that shape. */
export function adsrOf(curve: Curve): Adsr | null {
  const [p0, p1, p2, p3] = curve.points
  if (curve.points.length !== 4 || !p0 || !p1 || !p2 || !p3 || curve.sustain !== 2) return null
  if (p0.x !== 0 || p0.y !== 0 || p1.y !== 1 || p3.y !== 0) return null
  return { attack: p1.x - p0.x, decay: p2.x - p1.x, sustain: p2.y, release: p3.x - p2.x }
}

/**
 * The limits that keep a curve an ADSR. No points are added or removed and sustain stays on the
 * third point. The start is pinned at rest, the peak's level at 1 and the end's at rest. Moving
 * a point changes only the stage that ends there, and the later points ride along, so a longer
 * attack doesn't eat the decay. The whole shape stays within `maxX`.
 */
export function constrainAdsr(maxX = Infinity): CurveConstraint {
  return (next, prev) => {
    if (next.points.length !== 4 || prev.points.length !== 4 || next.sustain !== 2) return null
    const [n0, n1, n2, n3] = next.points
    const [p0, p1, p2, p3] = prev.points
    if (!(n0 && n1 && n2 && n3 && p0 && p1 && p2 && p3)) return null
    const [wa, wd, wr] = durations(p0, p1, p2, p3)
    const [na, nd, nr] = durations(n0, n1, n2, n3)
    // The stage whose end moved takes the new length; the others keep theirs.
    const moved = [n1.x !== p1.x, n2.x !== p2.x, n3.x !== p3.x].indexOf(true) + 1
    const len = [
      moved === 1 ? Math.max(0, na) : wa,
      moved === 2 ? Math.max(0, nd) : wd,
      moved === 3 ? Math.max(0, nr) : wr,
    ] as [number, number, number]
    const over = len[0] + len[1] + len[2] - maxX
    if (over > 0 && moved > 0) len[moved - 1] = Math.max(0, (len[moved - 1] ?? 0) - over)
    const ys = [0, 1, clamp(n2.y, 0, 1), 0]
    let x = 0
    const points = next.points.map((p, i) => {
      if (i > 0) x += len[i - 1] ?? 0
      return { ...p, x, y: ys[i] ?? p.y }
    })
    return { points, sustain: 2 }
  }
}

type Point = Curve["points"][number]

function durations(p0: Point, p1: Point, p2: Point, p3: Point): [number, number, number] {
  return [p1.x - p0.x, p2.x - p1.x, p3.x - p2.x]
}
