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
  /**
   * Optional: where the label sits. `inside` (the default) is the scrub handle at the left of the box;
   * `column` draws it as a grid item (subgrid across two columns of the caller's grid) so it lines up with
   * the panel's label column; `above` stacks it over the box. A host that ignores it keeps the label inside.
   */
  labelPlacement?: "inside" | "column" | "above"
  /** Optional: classes for the box when the label sits outside it. A host that ignores it keeps the box's own width. */
  boxClassName?: string
  /** Optional: a muted unit after the number, inside the box. */
  suffix?: React.ReactNode
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
