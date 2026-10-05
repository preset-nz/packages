import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"

export interface Size {
  width: number
  height: number
}

/** An element's size in CSS pixels, kept current by a `ResizeObserver`. */
export function useSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/**
 * Draws on a canvas at the device's pixel ratio, at most once per animation frame. `draw`
 * gets a context already scaled to CSS pixels. It runs again whenever `deps` change.
 */
export function useCanvasDraw(
  canvas: RefObject<HTMLCanvasElement | null>,
  size: Size,
  draw: (ctx: CanvasRenderingContext2D, size: Size) => void,
  deps: readonly unknown[],
) {
  const latest = useRef(draw)
  useLayoutEffect(() => {
    latest.current = draw
  })
  useEffect(() => {
    const el = canvas.current
    if (!el || size.width === 0 || size.height === 0) return
    const frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(size.width * dpr)
      const h = Math.round(size.height * dpr)
      if (el.width !== w) el.width = w
      if (el.height !== h) el.height = h
      const ctx = el.getContext("2d")
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.width, size.height)
      latest.current(ctx, size)
    })
    return () => cancelAnimationFrame(frame)
  }, [canvas, size, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
}
