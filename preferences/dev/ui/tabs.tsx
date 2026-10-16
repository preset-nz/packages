import type * as React from "react"

// ux-kit's tabs, which wrap Base UI: `Tabs` is the root, `TabsTrigger` the tab,
// `TabsContent` the panel. `onValueChange` passes event details second.

// biome-ignore lint/suspicious/noExplicitAny: Base UI types a tab value as any
type TabValue = any

type TabsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: TabValue
  defaultValue?: TabValue
  onValueChange?: (value: TabValue, eventDetails: unknown) => void
  orientation?: "horizontal" | "vertical"
}

export function Tabs({
  value: _v,
  defaultValue: _d,
  onValueChange: _o,
  orientation: _r,
  ...props
}: TabsProps) {
  return <div {...props} />
}

export function TabsList({
  variant: _variant,
  activateOnFocus: _a,
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "line"; activateOnFocus?: boolean }) {
  return <div role="tablist" {...props} />
}

export function TabsTrigger({
  value: _v,
  ...props
}: React.ComponentProps<"button"> & { value: TabValue }) {
  return <button type="button" role="tab" {...props} />
}

export function TabsContent({
  value: _v,
  ...props
}: React.ComponentProps<"div"> & { value: TabValue }) {
  return <div role="tabpanel" {...props} />
}
