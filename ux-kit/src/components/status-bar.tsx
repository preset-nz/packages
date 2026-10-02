import * as React from "react"

import { cn } from "../lib/utils"

// StatusBar: a thin bar at the bottom for document state, counts and transient
// messages (ux-patterns.md). `StatusBar` is the strip, `StatusItem` one cell,
// `StatusSpacer` pushes what follows to the right. Contents stay app-side.

function StatusBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-bar"
      role="status"
      className={cn("flex h-6 shrink-0 items-center gap-3 border-t border-border bg-background px-3 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

interface StatusItemProps extends React.ComponentProps<"span"> {
  /** Small leading label, e.g. "Nodes". */
  label?: string
}

function StatusItem({ label, className, children, ...props }: StatusItemProps) {
  return (
    <span data-slot="status-item" className={cn("flex items-center gap-1 tabular-nums", className)} {...props}>
      {label ? <span className="opacity-70">{label}</span> : null}
      <span className="text-foreground">{children}</span>
    </span>
  )
}

function StatusSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="status-spacer" className={cn("flex-1", className)} {...props} />
}

export { StatusBar, StatusItem, StatusSpacer }
