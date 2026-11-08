import type { HistogramBins } from "@preset.nz/ux-kit/graphics"

/** A bump of `height` centred on `at` (0..1), `width` wide, sampled over 256 bins. */
type Bump = { at: number; width: number; height: number }

function bins(bumps: Bump[], spikes: Record<number, number> = {}): Float32Array {
  const out = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = i / 255
    let v = 0
    for (const b of bumps) v += b.height * Math.exp(-(((x - b.at) / b.width) ** 2) / 2)
    out[i] = v
  }
  for (const [i, v] of Object.entries(spikes)) out[Number(i)] = (out[Number(i)] ?? 0) + v
  return out
}

/** A low-key landscape: dark foreground, a mid-grey sky, warm highlights. */
export const PHOTO: HistogramBins = {
  luma: bins([
    { at: 0.18, width: 0.08, height: 900 },
    { at: 0.55, width: 0.12, height: 520 },
    { at: 0.85, width: 0.05, height: 260 },
  ]),
  r: bins([
    { at: 0.2, width: 0.08, height: 800 },
    { at: 0.6, width: 0.12, height: 480 },
    { at: 0.9, width: 0.04, height: 300 },
  ]),
  g: bins([
    { at: 0.17, width: 0.07, height: 950 },
    { at: 0.52, width: 0.11, height: 540 },
    { at: 0.82, width: 0.05, height: 220 },
  ]),
  b: bins([
    { at: 0.14, width: 0.06, height: 1000 },
    { at: 0.62, width: 0.1, height: 600 },
    { at: 0.75, width: 0.05, height: 160 },
  ]),
}

/** The same picture with its highlights blown: a spike at 255 that flattens a linear scale. */
export const CLIPPED: HistogramBins = {
  luma: bins(
    [
      { at: 0.25, width: 0.1, height: 700 },
      { at: 0.7, width: 0.12, height: 420 },
    ],
    { 255: 12000, 254: 1400 },
  ),
}

/** A posterised picture: a handful of levels, best read as bars. */
export const POSTER: HistogramBins = {
  luma: Float32Array.from({ length: 32 }, (_, i) => (i % 4 === 0 ? 400 + ((i * 37) % 300) : 30)),
}
