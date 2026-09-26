import { useEffect, useState } from "react"

// Column widths, remembered separately from the session so Reset keeps them.
const KEY = "facets-playground:layout"

type Widths = { palette: number; json: number }
const DEFAULTS: Widths = { palette: 208, json: 440 }
const LIMITS: Record<keyof Widths, [number, number]> = {
  palette: [160, 360],
  json: [260, 900],
}

export function useColumnWidths() {
  const [widths, setWidths] = useState<Widths>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
    } catch {
      return DEFAULTS
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(widths))
    } catch {
      // Remembering the layout is a convenience.
    }
  }, [widths])
  const set = (col: keyof Widths, px: number) => {
    const [min, max] = LIMITS[col]
    setWidths((w) => ({ ...w, [col]: Math.round(Math.min(max, Math.max(min, px))) }))
  }
  const reset = (col: keyof Widths) => setWidths((w) => ({ ...w, [col]: DEFAULTS[col] }))
  return { widths, set, reset }
}

/**
 * A drag handle on a column's right edge. The parent must be `relative`.
 * Drag to resize, double-click to restore the default.
 */
export function ResizeHandle({
  width,
  onWidth,
  onReset,
  label,
}: {
  width: number
  onWidth: (px: number) => void
  onReset: () => void
  label: string
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title="Drag to resize, double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = width
        const el = e.currentTarget
        el.setPointerCapture(e.pointerId)
        const move = (ev: PointerEvent) => onWidth(startW + ev.clientX - startX)
        const up = () => {
          el.removeEventListener("pointermove", move)
          el.removeEventListener("pointerup", up)
          document.body.style.cursor = ""
        }
        el.addEventListener("pointermove", move)
        el.addEventListener("pointerup", up)
        document.body.style.cursor = "col-resize"
      }}
      className="absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize hover:bg-ring/30 active:bg-ring/50 md:block"
    />
  )
}

// The palette's help pane, as a share of the palette's height.
const SPLIT_KEY = "facets-playground:help-split"
const SPLIT_DEFAULT = 1 / 3
const SPLIT_LIMITS: [number, number] = [0.15, 0.7]

export function useHelpSplit() {
  const [share, setShare] = useState<number>(() => {
    try {
      const n = Number(localStorage.getItem(SPLIT_KEY))
      return n > 0 ? n : SPLIT_DEFAULT
    } catch {
      return SPLIT_DEFAULT
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_KEY, String(share))
    } catch {
      // As above.
    }
  }, [share])
  const set = (n: number) => setShare(Math.min(SPLIT_LIMITS[1], Math.max(SPLIT_LIMITS[0], n)))
  return { share, set, reset: () => setShare(SPLIT_DEFAULT) }
}

/**
 * A drag handle on a pane's top edge that sizes it as a share of `container`,
 * measured from the bottom. The parent must be `relative`. Double-click to
 * restore the default.
 */
export function SplitHandle({
  container,
  onShare,
  onReset,
  label,
}: {
  container: () => HTMLElement | null
  onShare: (share: number) => void
  onReset: () => void
  label: string
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      title="Drag to resize, double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        const box = container()?.getBoundingClientRect()
        if (!box) return
        e.preventDefault()
        const el = e.currentTarget
        el.setPointerCapture(e.pointerId)
        const move = (ev: PointerEvent) => onShare((box.bottom - ev.clientY) / box.height)
        const up = () => {
          el.removeEventListener("pointermove", move)
          el.removeEventListener("pointerup", up)
          document.body.style.cursor = ""
        }
        el.addEventListener("pointermove", move)
        el.addEventListener("pointerup", up)
        document.body.style.cursor = "row-resize"
      }}
      className="absolute inset-x-0 -top-1 z-10 hidden h-2 cursor-row-resize hover:bg-ring/30 active:bg-ring/50 md:block"
    />
  )
}
