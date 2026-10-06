/**
 * Typed to Base UI's `Slider.Root` as ux-kit wraps it: one thumb is a number, a
 * range an array. Narrowed to the props facets passes.
 */
export interface SliderProps {
  value?: number | readonly number[]
  onValueChange?: (value: number | number[], details: { reason?: string }) => void
  /** Fires once on pointer up or key up, with the final value. */
  onValueCommitted?: (value: number | readonly number[], details: { reason?: string }) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  "aria-label"?: string
  className?: string
}

export function Slider({ value, onValueChange, min, max, step, disabled, ...rest }: SliderProps) {
  return (
    <input
      type="range"
      aria-label={rest["aria-label"]}
      value={Array.isArray(value) ? value[0] : (value as number | undefined)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onValueChange?.(Number(e.target.value), {})}
    />
  )
}
