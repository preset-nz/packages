/**
 * The curve: points with a basis per point, plus segment tension and a sustain point for envelopes. One shape for
 * ux-kit's CurveEditor in transfer mode (0..1 to 0..1) and envelope mode
 * (x is time).
 *
 * The Rust half (`src/curve.rs`) mirrors this file in f32. Both are pinned by
 * `fixtures/curves.json`, which this file generates (`just fixtures`).
 */

import { clamp, lerp } from "./scalar.ts"

export type Basis = "constant" | "linear" | "monotone" | "catmull-rom"

export interface CurvePoint {
  x: number
  y: number
  /** Interpolation from this point to the next. Ignored on the last point. */
  basis: Basis
  /**
   * Bend of the segment to the next point, -1..1; 0 or absent is straight.
   * Only on a linear segment. Positive is slow then fast, negative fast then
   * slow.
   */
  tension?: number
}

export interface Curve {
  /** Sorted by x (see `sortPoints`), at least one. Equal x makes a step. */
  points: CurvePoint[]
  /** Index of the point an envelope holds at while the gate is down. */
  sustain?: number
}

/**
 * How far tension ±1 bends a segment. At +1 a segment's midpoint sits about
 * 5% of the way up; at +0.5, about 18%.
 */
export const TENSION_STRENGTH = 6

/** The exponential warp of a segment's local `t`. Monotone for any tension. */
export function tensionWarp(t: number, tension: number): number {
  const k = clamp(tension, -1, 1) * TENSION_STRENGTH
  if (Math.abs(k) < 1e-4) return t
  return Math.expm1(k * t) / Math.expm1(k)
}

/**
 * The curve's value at `x`. Before the first point it holds the first `y`,
 * after the last point the last `y`. On a step (two points at one x) the
 * later point wins. Assumes sorted points.
 */
export function evaluate(curve: Curve, x: number): number {
  const n = curve.points.length
  if (n === 0) return 0
  return evalRange(curve.points, 0, n - 1, x, undefined)
}

/**
 * An envelope's value at time `t`. Without `sustain` this is `evaluate`.
 * With it: while the gate is down (`release` absent, or `t < release`) the
 * curve plays up to the sustain point and holds its `y`. From `release` on,
 * the points after the sustain point play, shifted to start at `release`,
 * with the first release segment starting from the level reached at
 * `release`, so letting go early is smooth.
 */
export function evaluateEnvelope(curve: Curve, t: number, release?: number): number {
  const { points, sustain } = curve
  const n = points.length
  if (n === 0) return 0
  if (sustain === undefined || !Number.isInteger(sustain) || sustain < 0 || sustain >= n) {
    return evaluate(curve, t)
  }
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  const s = points[sustain]!
  const held = (u: number) => (u < s.x ? evalRange(points, 0, n - 1, u, undefined) : s.y)
  if (release === undefined || t < release) return held(t)
  const level = held(release)
  if (sustain === n - 1) return level
  return evalRange(points, sustain, n - 1, s.x + (t - release), level)
}

/** `n` evenly spaced samples from the first point's x to the last's. */
export function bake(curve: Curve, n: number): Float32Array {
  const pts = curve.points
  if (pts.length === 0) return new Float32Array(n)
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  return bakeRange(curve, pts[0]!.x, pts[pts.length - 1]!.x, n)
}

/** `n` evenly spaced samples of `evaluate` from `x0` to `x1`, both included. */
export function bakeRange(curve: Curve, x0: number, x1: number, n: number): Float32Array {
  const out = new Float32Array(Math.max(0, n))
  for (let i = 0; i < out.length; i++) {
    const x = out.length === 1 ? x0 : lerp(x0, x1, i / (out.length - 1))
    out[i] = evaluate(curve, x)
  }
  return out
}

/**
 * Reads a table from `bake` or `bakeRange` back at `x`, linearly between
 * samples, holding the ends outside `[x0, x1]`.
 */
export function evaluateBaked(lut: ArrayLike<number>, x0: number, x1: number, x: number): number {
  const n = lut.length
  if (n === 0) return 0
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  if (n === 1 || x1 === x0) return lut[0]!
  const p = clamp((x - x0) / (x1 - x0), 0, 1) * (n - 1)
  const i = Math.min(Math.floor(p), n - 2)
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  return lerp(lut[i]!, lut[i + 1]!, p - i)
}

/**
 * The same curve with its points stably sorted by x and `sustain` following
 * its point. Editors call this after a drag; `evaluate` assumes it.
 */
export function sortPoints(curve: Curve): Curve {
  const order = curve.points
    .map((_, i) => i)
    // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
    .sort((a, b) => curve.points[a]!.x - curve.points[b]!.x)
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  const points = order.map((i) => curve.points[i]!)
  if (curve.sustain === undefined) return { points }
  return { points, sustain: order.indexOf(curve.sustain) }
}

/**
 * The core: evaluates the points `lo..=hi` as a curve of their own, with
 * `points[lo].y` replaced by `startY` when given (an envelope's release).
 */
function evalRange(
  points: CurvePoint[],
  lo: number,
  hi: number,
  x: number,
  startY: number | undefined,
): number {
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  const px = (i: number) => points[i]!.x
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  const py = (i: number) => (i === lo && startY !== undefined ? startY : points[i]!.y)

  if (x < px(lo)) return py(lo)
  if (x >= px(hi)) return py(hi)

  // Largest i in [lo, hi - 1] with x_i <= x. Then x_{i+1} > x, so the
  // segment has width, and on a step the later point wins.
  let a = lo
  let b = hi - 1
  while (a < b) {
    const mid = (a + b + 1) >> 1
    if (px(mid) <= x) a = mid
    else b = mid - 1
  }
  const i = a
  // biome-ignore lint/style/noNonNullAssertion: indices are in range by construction; noUncheckedIndexedAccess types them as possibly undefined
  const p = points[i]!
  const x0 = px(i)
  const x1 = px(i + 1)
  const y0 = py(i)
  const y1 = py(i + 1)
  const h = x1 - x0
  const t = (x - x0) / h

  switch (p.basis) {
    case "constant":
      return y0
    case "linear":
      return lerp(y0, y1, tensionWarp(t, p.tension ?? 0))
    case "monotone":
    case "catmull-rom": {
      const m0 = tangent(i, p.basis)
      const m1 = tangent(i + 1, p.basis)
      return hermite(y0, y1, m0 * h, m1 * h, t)
    }
  }

  /** Slope of segment `k`, or undefined when it's outside the range or a step. */
  function secant(k: number): number | undefined {
    if (k < lo || k >= hi) return undefined
    const w = px(k + 1) - px(k)
    if (w <= 0) return undefined
    return (py(k + 1) - py(k)) / w
  }

  /**
   * The tangent at point `k`. One-sided at the ends of the range and beside a
   * step. Catmull-Rom takes the slope across both neighbours; monotone takes
   * the weighted harmonic mean of the two secants (Fritsch and Butland 1984,
   * as in SciPy's PchipInterpolator), zero at a local extremum, which keeps
   * each segment within its endpoints (Fritsch and Carlson 1980).
   */
  function tangent(k: number, basis: "monotone" | "catmull-rom"): number {
    const left = secant(k - 1)
    const right = secant(k)
    if (left === undefined) return right ?? 0
    if (right === undefined) return left
    if (basis === "catmull-rom") {
      return (py(k + 1) - py(k - 1)) / (px(k + 1) - px(k - 1))
    }
    if (left * right <= 0) return 0
    const h0 = px(k) - px(k - 1)
    const h1 = px(k + 1) - px(k)
    const w1 = 2 * h1 + h0
    const w2 = h1 + 2 * h0
    return (w1 + w2) / (w1 / left + w2 / right)
  }
}

/** Cubic Hermite on `t` in [0, 1], with tangents already scaled by the width. */
function hermite(y0: number, y1: number, m0: number, m1: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1
  )
}
