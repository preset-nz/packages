import { type Curve, clamp } from "@preset.nz/math"

import type { CurveConstraint } from "./curve-edits"

/** Where the gamma point sits on x. Its height is `0.5^(1/g)`, so it lies on `x^(1/g)`. */
const MID = 0.5

/** The height of the gamma point for gamma `g`. */
const heightOf = (g: number) => MID ** (1 / g)

/**
 * The curve a gamma shows as: the fixed ends and one point at the middle on `y = x^(1/g)`.
 * The points carry no line of their own: draw it with `CurveEditor`'s `line={gammaLine}`,
 * since a spline through three points is not a power curve.
 */
export function gammaCurve(g: number): Curve {
  return {
    points: [
      { x: 0, y: 0, basis: "monotone" },
      { x: MID, y: heightOf(g), basis: "monotone" },
      { x: 1, y: 1, basis: "monotone" },
    ],
  }
}

/** The gamma a gamma curve shows, `ln 0.5 / ln y` of its middle point, or `null` for another shape. */
export function gammaOf(curve: Curve): number | null {
  const p = curve.points[1]
  if (curve.points.length !== 3 || !p) return null
  const y = clamp(p.y, 1e-6, 1 - 1e-6)
  return Math.log(MID) / Math.log(y)
}

/** The line a gamma curve draws: `x^(1/g)` for the gamma its middle point shows, exactly. */
export function gammaLine(x: number, curve: Curve): number {
  const g = gammaOf(curve) ?? 1
  return Math.max(0, x) ** (1 / g)
}

/**
 * The limits that keep a curve a gamma between `min` and `max`. No points are added or removed
 * and no basis changes. The ends are pinned at (0, 0) and (1, 1), and the middle point moves
 * only up and down, between the heights of the two gammas.
 */
export function constrainGamma(min = 0.1, max = 5): CurveConstraint {
  const lo = heightOf(min)
  const hi = heightOf(max)
  return (next, prev) => {
    if (next.points.length !== 3 || prev.points.length !== 3) return null
    if (next.points.some((p, i) => p.basis !== prev.points[i]?.basis)) return null
    const mid = next.points[1]
    if (!mid) return null
    const [p0, , p2] = prev.points
    return {
      points: [
        { ...(p0 ?? mid), x: 0, y: 0 },
        { ...mid, x: MID, y: clamp(mid.y, lo, hi) },
        { ...(p2 ?? mid), x: 1, y: 1 },
      ],
    }
  }
}
