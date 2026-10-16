import type * as React from "react"

import { cn } from "../lib/utils"

// A colour chip. Any CSS colour string works; `null` draws the dashed "no
// colour" chip (Strata's colour label, Oblique's disabled optional colour).
// A checkerboard sits under the colour so transparency reads as transparency.

const CHECKER =
  "conic-gradient(var(--muted) 25%, transparent 0 50%, var(--muted) 0 75%, transparent 0) 0 0 / 8px 8px"

interface ColorSwatchProps extends Omit<React.ComponentProps<"span">, "color"> {
  /** A CSS colour (#rrggbbaa, rgb(), a variable), or null for none. */
  color?: string | null
  /** `sm` 12px, `md` 16px, `lg` 24px. */
  size?: "sm" | "md" | "lg"
  shape?: "square" | "round"
}

function ColorSwatch({
  color,
  size = "md",
  shape = "square",
  className,
  style,
  ...props
}: ColorSwatchProps) {
  return (
    <span
      data-slot="color-swatch"
      data-empty={color ? undefined : ""}
      role={props["aria-label"] ? "img" : undefined}
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn(
        "relative inline-block shrink-0 overflow-hidden border border-border",
        size === "sm" && "size-3",
        size === "md" && "size-4",
        size === "lg" && "size-6",
        shape === "round" ? "rounded-full" : "rounded-xs",
        !color && "border-dashed border-muted-foreground/60",
        className,
      )}
      style={color ? { background: CHECKER, ...style } : style}
      {...props}
    >
      {color ? <span className="absolute inset-0" style={{ backgroundColor: color }} /> : null}
    </span>
  )
}

export type { ColorSwatchProps }
export { ColorSwatch }
