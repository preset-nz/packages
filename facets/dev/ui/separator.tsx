import type * as React from "react"

/** Radix `Separator.Root`: native div props plus orientation and decorative. */
export function Separator({
  orientation: _orientation = "horizontal",
  decorative: _decorative = true,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}) {
  return <div {...props} />
}
