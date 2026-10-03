import * as React from "react"
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field"

import { cn } from "../lib/utils"
import { ArrowsHorizontalIcon } from "../icons"

// NumberField: a number you can drag. The label is the scrub handle (Base UI's ScrubArea);
// click it, or tab in, to type. Behaviour is Oblique's InputNumber on Base UI's NumberField:
// Shift is coarse (x10), Alt/Option is fine (x0.1), arrows step the same way, a typed value
// commits on blur or Enter and Escape puts the old value back, and an `integer` field never
// goes fractional under Alt (Oblique's integerStepFix). Props and callbacks only.
//
// The undo boundary is `onScrubStart` / `onScrubEnd`, as ColorField's `onPickStart/End`:
// between them, every `onValueChange` has `reason: "scrub"` and the app applies it inside one
// gesture. Escape during a scrub reverts the field and calls `onScrubCancel` instead of
// `onScrubEnd`. Typed values arrive once, as `reason: "typed"`, never per keystroke.
//
// While scrubbing the field shows only its own value and ignores incoming `value` props: an app
// that round-trips every change (rhizome gesture, then a refreshed prop) would otherwise fight
// the pointer with stale values. On release it re-syncs to the prop (a late echo of the scrub's
// own frames is skipped until the prop reaches the released value, or half a second passes).
// Outgoing scrub changes are sent at most once per animation frame, the last one flushed on release.

type ChangeReason = "scrub" | "step" | "typed"

interface NumberChange {
  /** `scrub`: live, between onScrubStart and onScrubEnd. `step`: arrow key, wheel or button. `typed`: committed text. */
  reason: ChangeReason
}

interface NumberFieldProps
  extends Omit<
    React.ComponentProps<"div">,
    "onChange" | "defaultValue" | "children" | "value"
  > {
  value: number
  onValueChange?: (value: number, details: NumberChange) => void
  min?: number
  max?: number
  /** One scrubbed pixel, one arrow key press. Default 1. */
  step?: number
  /** Alt/Option. Default `step / 10`, or `step` when `integer`. */
  smallStep?: number
  /** Shift. Default `step * 10`. */
  largeStep?: number
  /** Whole numbers only: no fractional display, and Alt never goes finer than `step`. */
  integer?: boolean
  /** Most decimal places shown and kept. Default: the places `smallStep` needs. */
  precision?: number
  /** Intl options for the display, merged over the precision and no digit grouping. */
  format?: Intl.NumberFormatOptions
  /** The scrub handle and the input's accessible name. */
  label: string
  /**
   * Where the label sits. `inside` (default): the handle at the left of the box. `column`: the handle
   * is a grid item in the caller's label column (the field spans two columns of a grid, as a
   * subgrid) and the box is the second, so labels and boxes line up across rows. `above`: the handle
   * stacks over a full-width box.
   */
  labelPlacement?: "inside" | "column" | "above"
  /**
   * Classes for the input box when the label sits outside it (`column`, `above`); with `inside` the
   * box is the root, so `className` does it. Panels use it to give every number one width.
   */
  boxClassName?: string
  /** A muted unit after the number, inside the box (`px`, `°`). */
  suffix?: React.ReactNode
  disabled?: boolean
  readOnly?: boolean
  /** The pointer went down on the label and started to move: open the app's undo transaction. */
  onScrubStart?: () => void
  /** The pointer came up after a scrub that changed something: close it. */
  onScrubEnd?: () => void
  /** Escape during a scrub: the field is back at its starting value, discard the transaction. Without it Escape does nothing. */
  onScrubCancel?: () => void
}

/** Decimal places a step implies: 0.1 gives 1, 5 gives 0. */
function placesOf(step: number): number {
  if (!Number.isFinite(step) || step === 0) return 0
  const s = Math.abs(step).toString()
  if (s.includes("e-")) return Number(s.split("e-")[1])
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  smallStep,
  largeStep,
  integer = false,
  precision,
  format,
  label,
  labelPlacement = "inside",
  boxClassName,
  suffix,
  disabled,
  readOnly,
  onScrubStart,
  onScrubEnd,
  onScrubCancel,
  className,
  ...props
}: NumberFieldProps) {
  const small = smallStep ?? (integer ? step : step / 10)
  const large = largeStep ?? step * 10
  const digits = integer ? 0 : (precision ?? placesOf(small))
  const options = React.useMemo<Intl.NumberFormatOptions>(
    () => ({ maximumFractionDigits: digits, useGrouping: false, ...format }),
    [digits, format]
  )

  // The field's own value, so a scrub follows the pointer without waiting for the app's round
  // trip. It follows the prop except while a scrub is in flight (and for a moment after it).
  const [local, setLocal] = React.useState<number | null>(value)
  const localRef = React.useRef<number | null>(value)
  const valueRef = React.useRef(value)
  const show = (v: number | null) => {
    localRef.current = v
    setLocal(v)
  }
  // Between the pointer going down on the label and coming up. `started`: it moved far enough
  // to change the value (a plain click is not a scrub).
  const scrub = React.useRef({ down: false, started: false, cancelled: false, from: value })
  const [scrubbing, setScrubbing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Set when the next blur must not report a typed value: Escape reverted it, or a scrub ended.
  const skipCommit = React.useRef(false)
  // After a release: the value the app is expected to echo back, and when to stop waiting for it.
  const settle = React.useRef<{ v: number; until: number; timer: number } | null>(null)
  // One outgoing scrub change per animation frame.
  const pending = React.useRef<{ v: number | null; raf: number }>({ v: null, raf: 0 })

  const clearSettle = () => {
    if (settle.current) window.clearTimeout(settle.current.timer)
    settle.current = null
  }
  const dropPending = () => {
    cancelAnimationFrame(pending.current.raf)
    pending.current = { v: null, raf: 0 }
  }
  const flushPending = () => {
    cancelAnimationFrame(pending.current.raf)
    const v = pending.current.v
    pending.current = { v: null, raf: 0 }
    if (v !== null) onValueChange?.(v, { reason: "scrub" })
  }
  const onValueChangeRef = React.useRef(onValueChange)
  React.useEffect(() => {
    onValueChangeRef.current = onValueChange
  })
  const queue = (v: number) => {
    pending.current.v = v
    if (pending.current.raf) return
    pending.current.raf = requestAnimationFrame(() => {
      pending.current.raf = 0
      const p = pending.current.v
      pending.current.v = null
      if (p !== null) onValueChangeRef.current?.(p, { reason: "scrub" })
    })
  }

  React.useEffect(() => {
    valueRef.current = value
    if (scrub.current.started) return
    const s = settle.current
    if (s && value !== s.v && Date.now() < s.until) return
    clearSettle()
    show(value)
  }, [value])

  React.useEffect(
    () => () => {
      clearSettle()
      cancelAnimationFrame(pending.current.raf)
    },
    []
  )

  // Escape while scrubbing. Captured so the app's own Escape (clear selection) doesn't also run.
  React.useEffect(() => {
    if (!scrubbing || !onScrubCancel) return
    const onKey = (e: KeyboardEvent) => {
      const s = scrub.current
      if (e.key !== "Escape" || !s.started || s.cancelled) return
      e.preventDefault()
      e.stopPropagation()
      s.cancelled = true
      dropPending()
      show(s.from)
      onScrubCancel()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [scrubbing, onScrubCancel])

  const change = (v: number | null, d: { reason: string }) => {
    if (d.reason === "scrub") {
      const s = scrub.current
      if (!s.down) {
        clearSettle()
        s.down = true
        s.started = false
        s.cancelled = false
        s.from = valueRef.current
      }
      if (s.cancelled || v === null) return
      if (!s.started) {
        s.started = true
        setScrubbing(true)
        onScrubStart?.()
      }
      show(v)
      queue(v)
    } else if (d.reason === "keyboard" || d.reason === "wheel" || d.reason.endsWith("-press")) {
      if (v === null) return
      show(v)
      onValueChange?.(v, { reason: "step" })
    } else {
      // Typing, paste, blur formatting: keep the text, tell the app on commit.
      show(v)
    }
  }

  const commit = (v: number | null, d: { reason: string }) => {
    if (d.reason === "scrub") {
      const s = scrub.current
      const { started, cancelled } = s
      s.down = false
      s.started = false
      s.cancelled = false
      setScrubbing(false)
      if (started) {
        // A dragged label must not leave the input focused: Cmd+Z would then undo its text.
        skipCommit.current = true
        inputRef.current?.blur()
        if (cancelled) {
          dropPending()
          show(valueRef.current)
        } else {
          flushPending()
          // Re-sync to the prop, once it has caught up with what was scrubbed.
          const v = localRef.current
          if (v !== null && v !== valueRef.current) {
            clearSettle()
            settle.current = {
              v,
              until: Date.now() + 500,
              timer: window.setTimeout(() => {
                settle.current = null
                show(valueRef.current)
              }, 500),
            }
          }
          onScrubEnd?.()
        }
      }
      return
    }
    if (d.reason === "input-blur" || d.reason === "input-clear") {
      if (skipCommit.current) {
        skipCommit.current = false
        show(valueRef.current)
        return
      }
      if (v === null) show(valueRef.current)
      else if (v !== valueRef.current) onValueChange?.(v, { reason: "typed" })
    }
  }

  const outside = labelPlacement !== "inside"
  const input = (
    <NumberFieldPrimitive.Input
      ref={inputRef}
      data-slot="number-field-input"
      aria-label={label}
      className="h-full w-full min-w-0 bg-transparent px-2 text-right tabular-nums outline-none selection:bg-selection/40 disabled:cursor-not-allowed"
      onFocus={(e) => {
        skipCommit.current = false
        e.currentTarget.select()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === "Escape") {
          skipCommit.current = true
          show(valueRef.current)
          e.currentTarget.blur()
        }
      }}
    />
  )
  const unit = suffix != null && (
    <span data-slot="number-field-suffix" className="flex shrink-0 items-center pr-2 text-muted-foreground select-none">
      {suffix}
    </span>
  )
  const boxClass =
    "flex h-8 min-w-0 flex-1 items-stretch rounded-none border border-input bg-transparent text-xs transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50 data-disabled:opacity-50 dark:bg-input/30"

  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      value={local}
      onValueChange={change}
      onValueCommitted={commit}
      min={min}
      max={max}
      step={step}
      smallStep={small}
      largeStep={large}
      format={options}
      disabled={disabled}
      readOnly={readOnly}
      locale="en-NZ"
      className={cn(
        "min-w-0",
        !outside && `group/number-field relative ${boxClass}`,
        labelPlacement === "column" && "col-span-2 grid grid-cols-subgrid items-center data-disabled:opacity-50",
        labelPlacement === "above" && "flex flex-col gap-1 data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <NumberFieldPrimitive.ScrubArea
        data-slot="number-field-label"
        title={outside ? label : undefined}
        pixelSensitivity={1}
        className={cn(
          outside
            ? "block min-w-0 truncate text-[11px] font-medium tracking-wide text-muted-foreground select-none"
            : "flex shrink-0 items-center border-r border-input px-2 text-muted-foreground select-none",
          disabled || readOnly
            ? "cursor-default"
            : cn(
                "cursor-ew-resize hover:text-foreground data-scrubbing:text-foreground",
                !outside && "hover:bg-muted data-scrubbing:bg-selection/20"
              )
        )}
      >
        {label}
        <NumberFieldPrimitive.ScrubAreaCursor className="drop-shadow-sm">
          <ArrowsHorizontalIcon className="size-4 text-foreground" weight="bold" />
        </NumberFieldPrimitive.ScrubAreaCursor>
      </NumberFieldPrimitive.ScrubArea>
      {outside ? (
        <div className={cn(boxClass, boxClassName)}>
          {input}
          {unit}
        </div>
      ) : (
        <>
          {input}
          {unit}
        </>
      )}
    </NumberFieldPrimitive.Root>
  )
}

const AXES = ["X", "Y", "Z", "W"]

interface VectorFieldProps
  extends Omit<
    NumberFieldProps,
    "value" | "onValueChange" | "label" | "className"
  > {
  value: number[]
  /** The whole vector with the changed component replaced. */
  onValueChange?: (value: number[], details: NumberChange) => void
  /** One per component. Default X, Y, Z, W, then 1, 2, 3. */
  labels?: string[]
  /** `row` puts the fields side by side (default), `column` stacks them. */
  orientation?: "row" | "column"
  className?: string
}

/** N NumberFields with axis labels. The scrub callbacks are the single field's, for whichever component is dragged. */
function VectorField({
  value,
  onValueChange,
  labels,
  orientation = "row",
  className,
  ...props
}: VectorFieldProps) {
  return (
    <div
      data-slot="vector-field"
      className={cn(
        "flex min-w-0 gap-1",
        orientation === "column" && "flex-col",
        className
      )}
    >
      {value.map((x, i) => (
        <NumberField
          key={i}
          {...props}
          label={labels?.[i] ?? (value.length <= AXES.length ? AXES[i] : String(i + 1))}
          value={x}
          onValueChange={(n, d) =>
            onValueChange?.(value.map((v, j) => (j === i ? n : v)), d)
          }
        />
      ))}
    </div>
  )
}

export { NumberField, VectorField }
export type { NumberChange, NumberFieldProps, VectorFieldProps }
