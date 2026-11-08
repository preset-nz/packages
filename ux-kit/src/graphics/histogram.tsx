import * as React from "react"

import { cn } from "../lib/utils"
import { useCanvasDraw, useSize } from "./use-canvas"
import { useTokenColours } from "./use-tokens"

/**
 * Precomputed bins, one array per channel, all the same length (usually 256). Pass `luma` for
 * a luma histogram, `r`, `g` and `b` for RGB overlaid, or all four. Bin `i` of `n` stands for
 * the value `i / (n - 1)`, so the first and last bins sit on the edges, where a transfer
 * curve's 0 and 1 are.
 */
export interface HistogramBins {
  luma?: ArrayLike<number>
  r?: ArrayLike<number>
  g?: ArrayLike<number>
  b?: ArrayLike<number>
}

export interface HistogramProps {
  bins: HistogramBins
  /** `area`: a filled outline. `bars`: one bar per bin. */
  variant?: "area" | "bars"
  /**
   * How counts map to height. `log` keeps a spike (clipped blacks or whites) from flattening
   * the rest of the histogram.
   */
  scale?: "linear" | "log"
  className?: string
  "aria-label"?: string
}

const TOKENS = ["muted-foreground", "channel-r", "channel-g", "channel-b"] as const
type Token = (typeof TOKENS)[number]

/** Drawn in this order, so luma sits behind the colour channels. */
const CHANNELS: { key: keyof HistogramBins; token: Token }[] = [
  { key: "luma", token: "muted-foreground" },
  { key: "r", token: "channel-r" },
  { key: "g", token: "channel-g" },
  { key: "b", token: "channel-b" },
]

/** The tallest bin across every channel given, so the channels share one height scale. */
function peakOf(bins: HistogramBins): number {
  let peak = 0
  for (const { key } of CHANNELS) {
    const arr = bins[key]
    if (!arr) continue
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i] ?? 0
      if (v > peak) peak = v
    }
  }
  return peak
}

/**
 * Draws precomputed histogram bins on a canvas that fills its parent, so it can sit inside a
 * `CurveEditor` as its `background`. It counts nothing itself: the app (or its Rust side) bins
 * the picture and hands the arrays over.
 */
export function Histogram({
  bins,
  variant = "area",
  scale = "linear",
  className,
  "aria-label": ariaLabel = "Histogram",
}: HistogramProps) {
  const box = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const size = useSize(box)
  const colours = useTokenColours(TOKENS)
  const peak = React.useMemo(() => peakOf(bins), [bins])

  useCanvasDraw(
    canvas,
    size,
    (ctx, { width, height }) => {
      if (peak <= 0) return
      const norm =
        scale === "log"
          ? (v: number) => Math.log1p(Math.max(0, v)) / Math.log1p(peak)
          : (v: number) => Math.max(0, v) / peak
      const colour = CHANNELS.filter((c) => c.key !== "luma" && bins[c.key])
      const overlaid = colour.length > 0

      for (const { key, token } of CHANNELS) {
        const arr = bins[key]
        if (!arr || arr.length === 0) continue
        const n = arr.length
        const xAt = (i: number) => (n === 1 ? width / 2 : (width * i) / (n - 1))
        const yAt = (i: number) => height - height * norm(arr[i] ?? 0)
        ctx.fillStyle = colours[token]
        ctx.strokeStyle = colours[token]
        // Luma alone reads as a solid shape; under colour channels it steps back.
        ctx.globalAlpha = key === "luma" ? (overlaid ? 0.25 : 0.45) : 0.35

        if (variant === "bars") {
          const w = width / n
          const gap = w >= 3 ? 1 : 0
          for (let i = 0; i < n; i++) {
            const top = yAt(i)
            const left = Math.max(0, xAt(i) - w / 2)
            const right = Math.min(width, xAt(i) + w / 2 - gap)
            if (right > left) ctx.fillRect(left, top, right - left, height - top)
          }
          continue
        }

        const line = new Path2D()
        for (let i = 0; i < n; i++) {
          if (i === 0) line.moveTo(xAt(i), yAt(i))
          else line.lineTo(xAt(i), yAt(i))
        }
        const area = new Path2D(line)
        area.lineTo(xAt(n - 1), height)
        area.lineTo(xAt(0), height)
        area.closePath()
        ctx.fill(area)
        if (key !== "luma") {
          ctx.globalAlpha = 0.8
          ctx.lineWidth = 1
          ctx.lineJoin = "round"
          ctx.stroke(line)
        }
      }
      ctx.globalAlpha = 1
    },
    [bins, peak, variant, scale, colours],
  )

  return (
    <div
      ref={box}
      role="img"
      aria-label={ariaLabel}
      className={cn("relative size-full", className)}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
