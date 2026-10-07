import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field"
import { useRef } from "react"

import { cn } from "@/lib/utils"

// The facets playground's own NumberField: the host contract, on Base UI. The label is the
// scrub handle; onScrubStart/End bracket one drag. No Shift/Alt step modifiers here.
interface NumberFieldProps {
  value: number
  onValueChange?: (value: number, details: { reason: "scrub" | "step" | "typed" }) => void
  min?: number
  max?: number
  step?: number
  integer?: boolean
  precision?: number
  /** Optional host props facets passes when a panel sets labelLayout; this stand-in ignores them. */
  labelPlacement?: "inside" | "column" | "above"
  suffix?: import("react").ReactNode
  label: string
  disabled?: boolean
  readOnly?: boolean
  onScrubStart?: () => void
  onScrubEnd?: () => void
  onScrubCancel?: () => void
  className?: string
}

function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  integer,
  precision,
  label,
  disabled,
  readOnly,
  onScrubStart,
  onScrubEnd,
  className,
}: NumberFieldProps) {
  const digits = integer ? 0 : (precision ?? 3)
  const started = useRef(false)
  return (
    <NumberFieldPrimitive.Root
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      readOnly={readOnly}
      format={{ maximumFractionDigits: digits, useGrouping: false }}
      onValueChange={(v, d) => {
        if (v === null) return
        if (d.reason === "scrub") {
          if (!started.current) {
            started.current = true
            onScrubStart?.()
          }
          onValueChange?.(v, { reason: "scrub" })
        } else if (d.reason === "keyboard" || d.reason === "wheel" || d.reason.endsWith("-press")) {
          onValueChange?.(v, { reason: "step" })
        }
      }}
      onValueCommitted={(v, d) => {
        if (d.reason === "scrub") {
          started.current = false
          onScrubEnd?.()
        } else if (d.reason === "input-blur" && v !== null && v !== value)
          onValueChange?.(v, { reason: "typed" })
      }}
      className={cn("flex h-8 min-w-0 flex-1 items-stretch border border-input text-xs", className)}
    >
      <NumberFieldPrimitive.ScrubArea className="flex shrink-0 cursor-ew-resize items-center border-r border-input px-2 text-muted-foreground select-none">
        {label}
      </NumberFieldPrimitive.ScrubArea>
      <NumberFieldPrimitive.Input
        aria-label={label}
        className="h-full w-full min-w-0 bg-transparent px-2 text-right tabular-nums outline-none"
      />
    </NumberFieldPrimitive.Root>
  )
}

export { NumberField }
