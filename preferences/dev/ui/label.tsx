import type * as React from "react"

/** shadcn `Label` wraps Radix `Label.Root`, whose props are the native ones. */
export function Label(props: React.ComponentProps<"label">) {
  return <label {...props} />
}
