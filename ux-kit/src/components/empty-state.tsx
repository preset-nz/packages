import * as React from "react"

import { cn } from "../lib/utils"

// EmptyState: what a view says when there is nothing to show: an icon, a
// title, one line of help and, if it helps, the action that fixes it.

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Usually one Button. */
  action?: React.ReactNode
}

function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex h-full flex-col items-center justify-center gap-2 p-8 text-center", className)}
      {...props}
    >
      {icon ? <div className="text-muted-foreground [&_svg]:size-8">{icon}</div> : null}
      <p className="font-heading text-base font-medium">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
