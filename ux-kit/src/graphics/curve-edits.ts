import {
  type Basis,
  type Curve,
  type CurvePoint,
  clamp,
  invlerp,
  TENSION_STRENGTH,
} from "@preset.nz/math"

/**
 * Limits on a curve, applied to every proposed edit: a drag, a nudge, an added or removed
 * point, a basis or sustain change. Return the curve to show (adjusted if need be), or `null`
 * to refuse the edit. `prev` is the curve before the edit, or the curve at the start of a
 * drag. An ADSR envelope is a curve with limits (`constrainAdsr`), not a different editor.
 */
export type CurveConstraint = (next: Curve, prev: Curve) => Curve | null

export interface Domain {
  x: readonly [number, number]
  y: readonly [number, number]
}

/** `next` through the constraint, or `next` itself without one. */
export function propose(next: Curve, prev: Curve, constrain?: CurveConstraint): Curve | null {
  return constrain ? constrain(next, prev) : next
}

/**
 * Point `i` of `start` moved to `(x, y)`, kept inside the domain. After the constraint, the
 * moved point is held between its neighbours, so the points stay sorted while indices stay put.
 */
export function movePoint(
  start: Curve,
  i: number,
  x: number,
  y: number,
  domain: Domain,
  constrain?: CurveConstraint,
): Curve | null {
  const points = start.points.map((p) => ({ ...p }))
  const p = points[i]
  if (!p) return null
  p.x = clamp(x, domain.x[0], domain.x[1])
  p.y = clamp(y, domain.y[0], domain.y[1])
  const next = propose({ ...start, points }, start, constrain)
  return next && keepOrder(next, i)
}

/** Point `i` held between its neighbours. Equal x is allowed: it makes a step. */
function keepOrder(curve: Curve, i: number): Curve {
  const pts = curve.points
  const p = pts[i]
  if (!p) return curve
  const lo = pts[i - 1]?.x ?? -Infinity
  const hi = pts[i + 1]?.x ?? Infinity
  if (p.x >= lo && p.x <= hi) return curve
  const points = pts.map((q, j) => (j === i ? { ...q, x: clamp(q.x, lo, hi) } : q))
  return { ...curve, points }
}

/**
 * A point added at `(x, y)`, in order. It takes the basis and tension of the segment it
 * splits, so the curve around it keeps its character. Returns the new curve and the new
 * point's index.
 */
export function addPoint(
  curve: Curve,
  x: number,
  y: number,
  domain: Domain,
  constrain?: CurveConstraint,
): { curve: Curve; index: number } | null {
  const px = clamp(x, domain.x[0], domain.x[1])
  const py = clamp(y, domain.y[0], domain.y[1])
  let index = curve.points.findIndex((p) => p.x > px)
  if (index < 0) index = curve.points.length
  const before = curve.points[index - 1] ?? curve.points[index]
  const point: CurvePoint = { x: px, y: py, basis: before?.basis ?? "linear" }
  if (before?.tension !== undefined) point.tension = before.tension
  const points = [...curve.points.slice(0, index), point, ...curve.points.slice(index)]
  const next: Curve = { ...curve, points }
  if (curve.sustain !== undefined && index <= curve.sustain) next.sustain = curve.sustain + 1
  const out = propose(next, curve, constrain)
  return out && { curve: out, index }
}

/** Point `i` removed. The last point can't be. Removing the sustain point clears sustain. */
export function removePoint(curve: Curve, i: number, constrain?: CurveConstraint): Curve | null {
  if (curve.points.length <= 1 || !curve.points[i]) return null
  const next: Curve = { points: curve.points.filter((_, j) => j !== i) }
  const s = curve.sustain
  if (s !== undefined && s !== i) next.sustain = s > i ? s - 1 : s
  return propose(next, curve, constrain)
}

/** Point `i`'s basis. Tension only means something on a linear segment, so others drop it. */
export function setBasis(
  curve: Curve,
  i: number,
  basis: Basis,
  constrain?: CurveConstraint,
): Curve | null {
  const points = curve.points.map((p, j) => {
    if (j !== i) return p
    const q: CurvePoint = { ...p, basis }
    if (basis !== "linear") delete q.tension
    return q
  })
  return propose({ ...curve, points }, curve, constrain)
}

/** Sustain on point `i`, or off when it is already there. */
export function toggleSustain(curve: Curve, i: number, constrain?: CurveConstraint): Curve | null {
  const next: Curve = { points: curve.points }
  if (curve.sustain !== i) next.sustain = i
  return propose(next, curve, constrain)
}

/** The tension of the segment from point `i`, -1..1. Zero removes it. */
export function setTension(
  curve: Curve,
  i: number,
  tension: number,
  constrain?: CurveConstraint,
): Curve | null {
  const t = clamp(tension, -1, 1)
  const points = curve.points.map((p, j) => {
    if (j !== i) return p
    const q: CurvePoint = { ...p }
    if (Math.abs(t) < 1e-3) delete q.tension
    else q.tension = t
    return q
  })
  return propose({ ...curve, points }, curve, constrain)
}

/**
 * The tension that puts a linear segment's midpoint at `y`. The warp at t = 0.5 is
 * `1 / (e^(k/2) + 1)`, so `k = 2 ln(1/w − 1)` where `w` is how far up the segment `y` sits.
 * `null` on a flat segment, where the midpoint can't move.
 */
export function tensionForMidpoint(y0: number, y1: number, y: number): number | null {
  if (Math.abs(y1 - y0) < 1e-9) return null
  const w = clamp(invlerp(y, y0, y1), 0.005, 0.995)
  return clamp((2 * Math.log(1 / w - 1)) / TENSION_STRENGTH, -1, 1)
}
