/**
 * Scalar shaping: interpolate, remap, ease, bias and gain.
 *
 * Mirrored by `src/scalar.rs`; both are pinned by `fixtures/scalars.json`.
 */

/** `a + t * (b - a)`. Unclamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Where `v` sits between `min` and `max`: the inverse of `lerp`. Unclamped.
 * When `min == max` it returns 0.5.
 */
export function invlerp(v: number, min: number, max: number): number {
  if (min === max) return 0.5;
  return (v - min) / (max - min);
}

/** `v` limited to `[min, max]`. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Maps `v` from `[omin, omax]` to `[nmin, nmax]`, clamped to the old range.
 * A degenerate old range (`omin == omax`) gives the midpoint of the new one,
 * following `invlerp`.
 */
export function fit(v: number, omin: number, omax: number, nmin: number, nmax: number): number {
  return lerp(nmin, nmax, clamp(invlerp(v, omin, omax), 0, 1));
}

/** `fit` without the clamp: values outside the old range extrapolate. */
export function fitUnclamped(v: number, omin: number, omax: number, nmin: number, nmax: number): number {
  return lerp(nmin, nmax, invlerp(v, omin, omax));
}

/**
 * 0 at or below `min`, 1 at or above `max`, and an ease in and out between
 * (`3t² − 2t³`).
 */
export function smooth(min: number, max: number, v: number): number {
  if (v <= min) return 0;
  if (v >= max) return 1;
  const t = (v - min) / (max - min);
  return t * t * (3 - 2 * t);
}

/**
 * Schlick's bias (Graphics Gems IV, 1994): bends `[0, 1]` towards 1 when
 * `b > 0.5` and towards 0 when `b < 0.5`; 0.5 is the identity. No `pow`, so
 * it is cheap on the audio thread. `v` and `b` are clamped to `[0, 1]`.
 */
export function bias(v: number, b: number): number {
  const x = clamp(v, 0, 1);
  const k = clamp(b, 0, 1);
  if (x === 0 || x === 1) return x;
  if (k === 0) return 0;
  if (k === 1) return 1;
  return x / ((1 / k - 2) * (1 - x) + 1);
}

/**
 * Schlick's gain: two mirrored halves of `bias`. `g > 0.5` steepens the
 * middle into an S, `g < 0.5` flattens it; 0.5 is the identity. Same
 * convention as Perlin's `gain`.
 */
export function gain(v: number, g: number): number {
  const x = clamp(v, 0, 1);
  return x < 0.5 ? bias(2 * x, 1 - g) / 2 : 1 - bias(2 - 2 * x, 1 - g) / 2;
}

/**
 * Perlin's bias (An Image Synthesizer, SIGGRAPH 1985): `v^(ln b / ln 0.5)`.
 * Draws a different curve from `bias` for the same `b`; kept for matching
 * existing looks. `v` and `b` are clamped to `[0, 1]`.
 */
export function biasPerlin(v: number, b: number): number {
  const x = clamp(v, 0, 1);
  const k = clamp(b, 0, 1);
  if (x === 0 || x === 1) return x;
  if (k === 0) return 0;
  if (k === 1) return 1;
  return Math.pow(x, Math.log(k) / Math.log(0.5));
}

/** Perlin's gain: two mirrored halves of `biasPerlin`. */
export function gainPerlin(v: number, g: number): number {
  const x = clamp(v, 0, 1);
  return x < 0.5 ? biasPerlin(2 * x, 1 - g) / 2 : 1 - biasPerlin(2 - 2 * x, 1 - g) / 2;
}
