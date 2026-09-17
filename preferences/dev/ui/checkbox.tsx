import type * as React from "react"

/**
 * Radix's tri-state checkbox. `"indeterminate"` is load-bearing: it is why
 * callers coerce with `Boolean(next)`. Do not narrow this to `boolean`.
 */
export type CheckedState = boolean | "indeterminate"

export function Checkbox({
  checked: _checked,
  onCheckedChange: _onCheckedChange,
  ...props
}: Omit<React.ComponentProps<"button">, "checked" | "onChange"> & {
  checked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
}) {
  return <button type="button" {...props} />
}
