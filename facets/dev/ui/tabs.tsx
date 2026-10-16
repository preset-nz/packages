import type * as React from "react"

// Base UI `Tabs`, as ux-kit wraps it under the shadcn names. The value is
// `any` in Base UI (string in Radix), so facets coerces it; typed `unknown`
// here so the harness checks that it does.

export function Tabs({
  value: _value,
  defaultValue: _defaultValue,
  onValueChange: _onValueChange,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: unknown
  defaultValue?: unknown
  onValueChange?: (value: unknown, eventDetails: unknown) => void
}) {
  return <div {...props} />
}

/** ux-kit's `variant` defaults to `"default"`, the segmented control facets uses. */
export function TabsList({
  variant: _variant,
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "line" | null }) {
  return <div role="tablist" {...props} />
}

export function TabsTrigger({
  value: _value,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & { value?: unknown }) {
  return <button type="button" role="tab" {...props} />
}

export function TabsContent({
  value: _value,
  keepMounted: _keepMounted,
  ...props
}: React.ComponentProps<"div"> & { value?: unknown; keepMounted?: boolean }) {
  return <div role="tabpanel" {...props} />
}
