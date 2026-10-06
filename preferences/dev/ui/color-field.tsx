import type * as React from "react"

/** Typed to ux-kit's `ColorField`, narrowed to the props facets passes. */
export interface ColorFieldProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** #rrggbb or #rrggbbaa; `null` shows the empty chip. */
  value: string | null
  /** A normalised hex, or `null` from a clear button. Without it the field is read-only. */
  onChange?: (value: string | null) => void
  label?: string
  presets?: string[]
  readOnly?: boolean
  disabled?: boolean
  /** The picker opened or closed: the undo boundary. */
  onPickStart?: () => void
  onPickEnd?: () => void
}

export function ColorField({ value, onChange, label, readOnly, disabled, onPickStart, onPickEnd }: ColorFieldProps) {
  return (
    <input
      type="text"
      aria-label={label ?? "Hex"}
      value={value ?? ""}
      readOnly={readOnly || !onChange}
      disabled={disabled}
      onFocus={onPickStart}
      onBlur={onPickEnd}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}
