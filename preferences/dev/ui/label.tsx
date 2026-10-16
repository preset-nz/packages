import type * as React from "react"

/** shadcn `Label` wraps Radix `Label.Root`, whose props are the native ones. */
export function Label(props: React.ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: a pass-through wrapper; the consumer supplies htmlFor
  return <label {...props} />
}
