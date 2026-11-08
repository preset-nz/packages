import { type Curve, clamp } from "@preset.nz/math"

import type { CurveConstraint } from "./curve-edits"

/**
 * A levels remap on 0..1 axes. Inputs at or below `black` become `outBlack`, at or above `white`
 * become `outWhite`, and between them
 * `outBlack + (outWhite - outBlack) · ((x - black) / (white - black))^(1/gamma)`.
 * `outBlack` and `outWhite` default to 0 and 1.
 */
export interface Levels {
  black: number
  white: number
  gamma: number
  outBlack?: number
  outWhite?: number
}

/** The narrowest span either pair of ends can close to: one level of 255. */
const MIN_SPAN = 1 / 255

/** How far up the span between the ends the gamma point sits, for gamma `g`. */
const heightOf = (g: number) => 0.5 ** (1 / g)

/** The gamma whose point sits `s` of the way up the span. */
const gammaAt = (s: number) => Math.log(0.5) / Math.log(clamp(s, 1e-6, 1 - 1e-6))

/**
 * The curve a levels remap shows as: the black end at (`black`, `outBlack`), the white end at
 * (`white`, `outWhite`), and the gamma point halfway between them on the power curve. The
 * points carry no line of their own: draw it with `CurveEditor`'s `line={levelsLine}`, since a
 * spline through three points is not a power curve.
 */
export function levelsCurve({ black, white, gamma, outBlack = 0, outWhite = 1 }: Levels): Curve {
  const b = clamp(black, 0, 1 - MIN_SPAN)
  const w = clamp(white, b + MIN_SPAN, 1)
  const ob = clamp(outBlack, 0, 1 - MIN_SPAN)
  const ow = clamp(outWhite, ob + MIN_SPAN, 1)
  return {
    points: [
      { x: b, y: ob, basis: "monotone" },
      { x: (b + w) / 2, y: ob + (ow - ob) * heightOf(gamma), basis: "monotone" },
      { x: w, y: ow, basis: "monotone" },
    ],
  }
}

/** The remap a levels curve shows, or `null` for another shape. */
export function levelsOf(curve: Curve): Required<Levels> | null {
  const [p0, p1, p2] = curve.points
  if (curve.points.length !== 3 || !p0 || !p1 || !p2) return null
  const span = p2.y - p0.y
  return {
    black: p0.x,
    white: p2.x,
    gamma: gammaAt(span > 0 ? (p1.y - p0.y) / span : 0.5),
    outBlack: p0.y,
    outWhite: p2.y,
  }
}

/** The line a levels curve draws: flat at output black before black, at output white after white, the power curve between. */
export function levelsLine(x: number, curve: Curve): number {
  const l = levelsOf(curve)
  if (!l) return x
  if (x <= l.black) return l.outBlack
  if (x >= l.white) return l.outWhite
  const t = (x - l.black) / (l.white - l.black)
  return l.outBlack + (l.outWhite - l.outBlack) * t ** (1 / l.gamma)
}

/**
 * The limits that keep a curve a levels remap with gamma between `min` and `max`. No points
 * are added or removed and no basis changes. Each end moves freely, but the black end stays at
 * least one level left of and below the white end, so the remap never crosses into an invert.
 * The gamma point moves only up and down, and when an end moves it rides along, halfway
 * between the ends at the same gamma.
 */
export function constrainLevels(min = 0.1, max = 5): CurveConstraint {
  const lo = heightOf(min)
  const hi = heightOf(max)
  return (next, prev) => {
    if (next.points.length !== 3 || prev.points.length !== 3) return null
    if (next.points.some((p, i) => p.basis !== prev.points[i]?.basis)) return null
    const [n0, n1, n2] = next.points
    const [q0, q1, q2] = prev.points
    if (!(n0 && n1 && n2 && q0 && q1 && q2)) return null
    // Whichever end moved keeps its new place; the other stays, at least one level away.
    const blackMoved = n0.x !== q0.x || n0.y !== q0.y
    let b = n0.x
    let w = n2.x
    let ob = n0.y
    let ow = n2.y
    if (blackMoved) {
      b = clamp(b, 0, w - MIN_SPAN)
      ob = clamp(ob, 0, ow - MIN_SPAN)
    } else {
      w = clamp(w, b + MIN_SPAN, 1)
      ow = clamp(ow, ob + MIN_SPAN, 1)
    }
    // The gamma point's share of the span: new if it was dragged, kept if an end moved.
    const prevSpan = q2.y - q0.y
    const share =
      n1.y !== q1.y ? (n1.y - ob) / (ow - ob) : prevSpan > 0 ? (q1.y - q0.y) / prevSpan : 0.5
    return {
      points: [
        { ...n0, x: b, y: ob },
        { ...n1, x: (b + w) / 2, y: ob + (ow - ob) * clamp(share, lo, hi) },
        { ...n2, x: w, y: ow },
      ],
    }
  }
}
