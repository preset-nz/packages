import type * as React from "react"

/** shadcn `Input` is a thin pass-through over the native element. */
export function Input(props: React.ComponentProps<"input">) {
  return <input {...props} />
}
