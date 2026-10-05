import * as React from "react"
import { evaluate, type Basis, type Curve } from "@preset.nz/math"

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../components/context-menu"
import { cn } from "../lib/utils"
import {
  addPoint,
  movePoint,
  removePoint,
  setBasis,
  setTension,
  tensionForMidpoint,
  toggleSustain,
  type CurveConstraint,
  type Domain,
} from "./curve-edits"
import { linearScale } from "./scale"
import { useCanvasDraw, useSize } from "./use-canvas"
import { useTokenColours } from "./use-tokens"

/** How an edit arrived: inside a drag, as one keyboard nudge, or as a single discrete edit. */
export type CurveEditKind = "gesture" | "nudge" | "edit"

export interface CurveEditorProps {
  value: Curve
  /**
   * Every change. Inside a drag (`"gesture"`) the calls fall between `onGestureStart` and
   * `onGestureEnd`, so the host makes the drag one undo step. A nudge is streamed input the
   * host may coalesce; an edit is one step on its own.
   */
  onChange: (next: Curve, kind: CurveEditKind) => void
  onGestureStart?: () => void
  /**
   * The drag is over. `false` when Escape cancelled it, after `onChange` has already put the
   * curve back as it was when the drag began.
   */
  onGestureEnd?: (committed: boolean) => void
  /**
   * `transfer`: input to output, 0..1 on both axes, over a histogram. `envelope`: x is time,
   * over a waveform, and a point can carry the sustain mark.
   */
  mode?: "transfer" | "envelope"
  /** The x range. Defaults to 0..1. An envelope's is seconds, beats, or 0..1 when fitted. */
  xDomain?: readonly [number, number]
  /** The y range. Defaults to 0..1. */
  yDomain?: readonly [number, number]
  /** Limits applied to every edit. See `CurveConstraint`. */
  constrain?: CurveConstraint
  /** How an x or y value reads in the point readout. */
  formatX?: (x: number) => string
  formatY?: (y: number) => string
  /** Drawn behind the curve, inside the plot area: a `Histogram` or a `Waveform`. */
  background?: React.ReactNode
  className?: string
  "aria-label"?: string
}

const PAD = 10
const POINT_R = 4.5
const HIT_R = 10
const NUDGE = 0.01
const DRAG_THRESHOLD = 3
const BASES: { value: Basis; label: string }[] = [
  { value: "constant", label: "Constant" },
  { value: "linear", label: "Linear" },
  { value: "monotone", label: "Monotone" },
  { value: "catmull-rom", label: "Catmull-Rom" },
]
const TOKENS = ["foreground", "muted-foreground", "border", "primary", "warning"] as const

/** A press on a handle. It becomes a gesture only once it has moved `DRAG_THRESHOLD` pixels. */
type Drag = {
  kind: "point" | "tension"
  index: number
  start: Curve
  pointer: number
  from: { x: number; y: number }
  started: boolean
}

type MenuTarget =
  | { kind: "point"; index: number }
  | { kind: "segment"; index: number }
  | { kind: "empty"; x: number; y: number }

const defaultFormat = (v: number) => v.toFixed(3)

/** Whether two curves draw the same, whatever order the host's copy keeps its keys in. */
function sameCurve(a: Curve, b: Curve): boolean {
  if (a.points.length !== b.points.length || (a.sustain ?? -1) !== (b.sustain ?? -1)) return false
  return a.points.every((p, i) => {
    const q = b.points[i]!
    return p.x === q.x && p.y === q.y && p.basis === q.basis && (p.tension ?? 0) === (q.tension ?? 0)
  })
}

/**
 * Edits a `@preset.nz/math` curve. The line is drawn on a canvas by sampling math's own
 * `evaluate`, so it is exactly what Rust will compute. Points and tension handles are SVG on
 * top, focusable and keyboard driven. Double-click to add a point; Delete removes the selected
 * one; arrows nudge it (Shift ×10, Option ×0.1). Basis and sustain are in the context menu.
 */
export function CurveEditor({
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  mode = "transfer",
  xDomain = [0, 1],
  yDomain = [0, 1],
  constrain,
  formatX = defaultFormat,
  formatY = defaultFormat,
  background,
  className,
  "aria-label": ariaLabel = "Curve",
}: CurveEditorProps) {
  const box = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const svg = React.useRef<SVGSVGElement>(null)
  const size = useSize(box)
  const colours = useTokenColours(TOKENS)

  // The scrub rule: during a drag the view shows its own value, not the host's echo. After
  // release it keeps showing it until the host's value catches up, so the line can't flick back
  // to an echo from mid-drag.
  const [live, setLive] = React.useState<{ curve: Curve; held: boolean } | null>(null)
  const drag = React.useRef<Drag | null>(null)
  if (live?.held && sameCurve(live.curve, value)) setLive(null)
  const curve = live?.curve ?? value
  React.useEffect(() => {
    if (!live?.held) return
    // A host that normalises the curve never echoes it exactly; let go regardless.
    const timer = setTimeout(() => setLive(null), 1000)
    return () => clearTimeout(timer)
  }, [live])
  const [selected, setSelected] = React.useState<number | null>(null)
  const [menu, setMenu] = React.useState<MenuTarget | null>(null)

  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const domain: Domain = React.useMemo(() => ({ x: [x0, x1], y: [y0, y1] }), [x0, x1, y0, y1])
  const sx = React.useMemo(() => linearScale([x0, x1], [PAD, Math.max(PAD, size.width - PAD)]), [x0, x1, size.width])
  const sy = React.useMemo(() => linearScale([y0, y1], [Math.max(PAD, size.height - PAD), PAD]), [y0, y1, size.height])

  const sel = selected !== null && selected < curve.points.length ? selected : null

  useCanvasDraw(
    canvas,
    size,
    (ctx, { width, height }) => {
      // Quarters of each axis, faint.
      ctx.strokeStyle = colours.border
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 0; k <= 4; k++) {
        const px = Math.round(sx(x0 + ((x1 - x0) * k) / 4)) + 0.5
        const py = Math.round(sy(y0 + ((y1 - y0) * k) / 4)) + 0.5
        ctx.moveTo(px, PAD)
        ctx.lineTo(px, height - PAD)
        ctx.moveTo(PAD, py)
        ctx.lineTo(width - PAD, py)
      }
      ctx.stroke()

      if (mode === "envelope" && curve.sustain !== undefined) {
        const s = curve.points[curve.sustain]
        if (s) {
          ctx.strokeStyle = colours["muted-foreground"]
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          const px = Math.round(sx(s.x)) + 0.5
          ctx.moveTo(px, PAD)
          ctx.lineTo(px, height - PAD)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      if (curve.points.length === 0) return
      // One sample per device pixel, through math's evaluate.
      const dpr = window.devicePixelRatio || 1
      const steps = Math.max(2, Math.ceil((width - 2 * PAD) * dpr))
      const line = new Path2D()
      for (let k = 0; k <= steps; k++) {
        const px = PAD + ((width - 2 * PAD) * k) / steps
        const py = sy(evaluate(curve, sx.invert(px)))
        if (k === 0) line.moveTo(px, py)
        else line.lineTo(px, py)
      }
      const area = new Path2D(line)
      area.lineTo(width - PAD, sy(y0))
      area.lineTo(PAD, sy(y0))
      area.closePath()
      ctx.fillStyle = colours.primary
      ctx.globalAlpha = 0.12
      ctx.fill(area)
      ctx.globalAlpha = 1
      ctx.strokeStyle = colours.primary
      ctx.lineWidth = 1.5
      ctx.lineJoin = "round"
      ctx.stroke(line)
    },
    [curve, colours, sx, sy, mode],
  )

  const toData = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: sx.invert(e.clientX - r.left), y: sy.invert(e.clientY - r.top) }
  }

  const commit = (next: Curve | null, kind: CurveEditKind) => {
    if (next) onChange(next, kind)
  }

  const beginDrag = (e: React.PointerEvent, d: Drag) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    svg.current?.setPointerCapture(e.pointerId)
    drag.current = d
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointer) return
    // A click is not a drag: nothing reaches the host, or its undo, until the pointer moves.
    if (!d.started) {
      if (Math.hypot(e.clientX - d.from.x, e.clientY - d.from.y) < DRAG_THRESHOLD) return
      d.started = true
      setLive({ curve: d.start, held: false })
      onGestureStart?.()
    }
    const { x, y } = toData(e)
    let next: Curve | null = null
    if (d.kind === "point") {
      next = movePoint(d.start, d.index, x, y, domain, constrain)
    } else {
      const a = d.start.points[d.index]
      const b = d.start.points[d.index + 1]
      const t = a && b ? tensionForMidpoint(a.y, b.y, y) : null
      if (t !== null) next = setTension(d.start, d.index, t, constrain)
    }
    if (next) {
      setLive({ curve: next, held: false })
      onChange(next, "gesture")
    }
  }

  const finishDrag = (committed: boolean) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (!d.started) return
    if (!committed) onChange(d.start, "gesture")
    setLive((l) => ({ curve: committed && l ? l.curve : d.start, held: true }))
    onGestureEnd?.(committed)
  }

  // Escape cancels a drag wherever focus is.
  React.useEffect(() => {
    if (!drag.current?.started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current) {
        e.preventDefault()
        finishDrag(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const onPointKey = (e: React.KeyboardEvent, i: number) => {
    const p = curve.points[i]
    if (!p) return
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      const next = removePoint(curve, i, constrain)
      if (next) {
        commit(next, "edit")
        setSelected(Math.min(i, next.points.length - 1))
      }
      return
    }
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    }
    const dir = arrows[e.key]
    if (!dir) return
    e.preventDefault()
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    const dx = dir[0] * (x1 - x0) * NUDGE * mult
    const dy = dir[1] * (y1 - y0) * NUDGE * mult
    commit(movePoint(curve, i, p.x + dx, p.y + dy, domain, constrain), "nudge")
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = toData(e)
    const added = addPoint(curve, x, y, domain, constrain)
    if (added) {
      commit(added.curve, "edit")
      setSelected(added.index)
    }
  }

  // What the menu would do, tried against the constraint so a refused item shows disabled.
  const target = menu
  const menuPoint = target?.kind === "point" ? curve.points[target.index] : undefined

  const readout = sel !== null ? curve.points[sel] : undefined

  return (
    <ContextMenu onOpenChange={(open) => !open && setMenu(null)}>
      <ContextMenuTrigger
        ref={box}
        className={cn("relative h-48 w-full overflow-hidden rounded-md border bg-card", className)}
      >
        {background && (
          <div className="pointer-events-none absolute" style={{ inset: PAD }}>
            {background}
          </div>
        )}
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        <svg
          ref={svg}
          role="group"
          aria-label={ariaLabel}
          className="absolute inset-0 size-full touch-none"
          onPointerMove={onPointerMove}
          onPointerUp={() => finishDrag(true)}
          onLostPointerCapture={() => finishDrag(true)}
        >
          <rect
            width="100%"
            height="100%"
            fill="transparent"
            onPointerDown={() => setSelected(null)}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => setMenu({ kind: "empty", ...toData(e) })}
          />
          {curve.points.map((p, i) => {
            const next = curve.points[i + 1]
            if (!next || p.basis !== "linear" || next.x === p.x) return null
            const mx = (p.x + next.x) / 2
            return (
              <g
                key={`t${i}`}
                className="cursor-ns-resize"
                onPointerDown={(e) => beginDrag(e, { kind: "tension", index: i, start: curve, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, started: false })}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  commit(setTension(curve, i, 0, constrain), "edit")
                }}
                onContextMenu={() => setMenu({ kind: "segment", index: i })}
              >
                <title>Drag to bend this segment; double-click to straighten</title>
                <circle cx={sx(mx)} cy={sy(evaluate(curve, mx))} r={HIT_R} fill="transparent" />
                <rect
                  x={sx(mx) - 3}
                  y={sy(evaluate(curve, mx)) - 3}
                  width={6}
                  height={6}
                  transform={`rotate(45 ${sx(mx)} ${sy(evaluate(curve, mx))})`}
                  className="fill-background stroke-muted-foreground"
                  strokeWidth={1}
                />
              </g>
            )
          })}
          {curve.points.map((p, i) => {
            const isSel = sel === i
            const isSustain = mode === "envelope" && curve.sustain === i
            return (
              <g
                key={`p${i}`}
                tabIndex={0}
                role="button"
                aria-label={`Point ${i + 1}: ${formatX(p.x)}, ${formatY(p.y)}${isSustain ? ", sustain" : ""}`}
                aria-pressed={isSel}
                className="cursor-grab outline-none focus-visible:[&>[data-ring]]:stroke-ring"
                onFocus={() => setSelected(i)}
                onKeyDown={(e) => onPointKey(e, i)}
                onPointerDown={(e) => {
                  setSelected(i)
                  ;(e.currentTarget as SVGGElement).focus()
                  beginDrag(e, { kind: "point", index: i, start: curve, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, started: false })
                }}
                onContextMenu={() => {
                  setSelected(i)
                  setMenu({ kind: "point", index: i })
                }}
              >
                <circle cx={sx(p.x)} cy={sy(p.y)} r={HIT_R} fill="transparent" />
                <circle
                  data-ring
                  className="fill-none stroke-transparent"
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={POINT_R + 3}
                  strokeWidth={2}
                />
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={POINT_R}
                  strokeWidth={1.5}
                  className={cn(isSel ? "fill-primary stroke-primary" : "fill-background stroke-primary")}
                />
                {isSustain && (
                  <text
                    x={sx(p.x) + 8}
                    y={sy(p.y) - 8}
                    className="fill-muted-foreground font-mono text-[10px] select-none"
                  >
                    S
                  </text>
                )}
              </g>
            )
          })}
          {readout && (
            <text
              x={size.width - PAD - 2}
              y={PAD + 10}
              textAnchor="end"
              className="pointer-events-none fill-muted-foreground font-mono text-[10px] select-none"
            >
              {formatX(readout.x)} · {formatY(readout.y)}
            </text>
          )}
        </svg>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {target?.kind === "point" && menuPoint && (
          <>
            {/* Base UI's group label throws outside a group. */}
            <ContextMenuGroup>
              <ContextMenuLabel>Interpolation to the next point</ContextMenuLabel>
              <ContextMenuRadioGroup
                value={menuPoint.basis}
                onValueChange={(b) => commit(setBasis(curve, target.index, b as Basis, constrain), "edit")}
              >
                {BASES.map((b) => (
                  <ContextMenuRadioItem
                    key={b.value}
                    value={b.value}
                    disabled={
                      target.index === curve.points.length - 1 ||
                      (b.value !== menuPoint.basis && !setBasis(curve, target.index, b.value, constrain))
                    }
                  >
                    {b.label}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuGroup>
            {mode === "envelope" && (
              <>
                <ContextMenuSeparator />
                <ContextMenuCheckboxItem
                  checked={curve.sustain === target.index}
                  disabled={!toggleSustain(curve, target.index, constrain)}
                  onCheckedChange={() => commit(toggleSustain(curve, target.index, constrain), "edit")}
                >
                  Sustain here
                </ContextMenuCheckboxItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={!removePoint(curve, target.index, constrain)}
              onClick={() => {
                const next = removePoint(curve, target.index, constrain)
                if (next) {
                  commit(next, "edit")
                  setSelected(null)
                }
              }}
            >
              Delete Point
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
        {target?.kind === "segment" && (
          <ContextMenuItem
            disabled={!curve.points[target.index]?.tension}
            onClick={() => commit(setTension(curve, target.index, 0, constrain), "edit")}
          >
            Straighten Segment
          </ContextMenuItem>
        )}
        {target?.kind === "empty" && (
          <ContextMenuItem
            disabled={!addPoint(curve, target.x, target.y, domain, constrain)}
            onClick={() => {
              const added = addPoint(curve, target.x, target.y, domain, constrain)
              if (added) {
                commit(added.curve, "edit")
                setSelected(added.index)
              }
            }}
          >
            Add Point Here
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
