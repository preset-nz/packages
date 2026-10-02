import type * as React from "react"

/** Typed to ux-kit's `NumberField`, narrowed to the props facets passes. */
export interface NumberFieldProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue" | "children" | "value"> {
  value: number
  /** `scrub`: live, between onScrubStart and onScrubEnd. `step`: arrow key or wheel. `typed`: committed text. */
  onValueChange?: (value: number, details: { reason: "scrub" | "step" | "typed" }) => void
  min?: number
  max?: number
  step?: number
  integer?: boolean
  precision?: number
  /** The scrub handle and the input's accessible name. */
  label: string
  disabled?: boolean
  readOnly?: boolean
  onScrubStart?: () => void
  onScrubEnd?: () => void
  onScrubCancel?: () => void
}

export function NumberField({
  value,
  onValueChange,
  label,
  min,
  max,
  step,
  disabled,
  readOnly,
}: NumberFieldProps) {
  return (
    <input
      type="number"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      readOnly={readOnly}
      onChange={(e) => onValueChange?.(Number(e.target.value), { reason: "typed" })}
    />
  )
}
