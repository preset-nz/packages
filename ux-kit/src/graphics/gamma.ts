import { type Curve, clamp } from "@preset.nz/math"

import type { CurveConstraint } from "./curve-edits"

/**
 * A levels remap on a 0..1 axis: inputs at or below `black` become 0, at or above `white`
 * become 1, and between them `((x - black) / (white - black))^(1/gamma)`.
 */
export interface Levels {
  black: number
  white: number
  gamma: number
}

/** The narrowest black-to-white span the ends can close to. */
const MIN_SPAN = 1 / 255

/** The height of the gamma point, halfway between the ends, for gamma `g`. */
const heightOf = (g: number) => 0.5 ** (1 / g)

/**
 * The curve a levels remap shows as: the black end on the floor at `black`, the white end on
 * the ceiling at `white`, and the gamma point halfway between them on the power curve. The
 * points carry no line of their own: draw it with `CurveEditor`'s `line={levelsLine}`, since a
 * spline through three points is not a power curve.
 */
export function levelsCurve({ black, white, gamma }: Levels): Curve {
  const b = clamp(black, 0, 1 - MIN_SPAN)
  const w = clamp(white, b + MIN_SPAN, 1)
  return {
    points: [
      { x: b, y: 0, basis: "monotone" },
      { x: (b + w) / 2, y: heightOf(gamma), basis: "monotone" },
      { x: w, y: 1, basis: "monotone" },
    ],
  }
}

/** The remap a levels curve shows, or `null` for another shape. */
export function levelsOf(curve: Curve): Levels | null {
  const [p0, p1, p2] = curve.points
  if (curve.points.length !== 3 || !p0 || !p1 || !p2) return null
  const y = clamp(p1.y, 1e-6, 1 - 1e-6)
  return { black: p0.x, white: p2.x, gamma: Math.log(0.5) / Math.log(y) }
}

/** The line a levels curve draws: the floor before black, the ceiling after white, the power curve between. */
export function levelsLine(x: number, curve: Curve): number {
  const l = levelsOf(curve)
  if (!l) return x
  if (x <= l.black) return 0
  if (x >= l.white) return 1
  return ((x - l.black) / (l.white - l.black)) ** (1 / l.gamma)
}

/**
 * The limits that keep a curve a levels remap with gamma between `min` and `max`. No points
 * are added or removed and no basis changes. The black end slides along the floor and the white
 * end along the ceiling, never closer than one level; the gamma point moves only up and down,
 * and rides halfway between the ends when they move.
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
    let b = n0.x
    let w = n2.x
    if (b !== q0.x) b = clamp(b, 0, w - MIN_SPAN)
    else w = clamp(w, b + MIN_SPAN, 1)
    return {
      points: [
        { ...n0, x: b, y: 0 },
        { ...n1, x: (b + w) / 2, y: clamp(n1.y, lo, hi) },
        { ...n2, x: w, y: 1 },
      ],
    }
  }
}
