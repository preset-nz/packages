import { fitUnclamped } from "@preset.nz/math"

/**
 * One axis's mapping between data and pixels. Both layers of a view draw through it, and
 * pointer events come back through `invert`, so a handle can't drift off its line.
 */
export interface LinearScale {
  (v: number): number
  invert: (px: number) => number
  domain: readonly [number, number]
  range: readonly [number, number]
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number]): LinearScale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const scale = ((v: number) => fitUnclamped(v, d0, d1, r0, r1)) as LinearScale
  scale.invert = (px: number) => fitUnclamped(px, r0, r1, d0, d1)
  scale.domain = domain
  scale.range = range
  return scale
}
