import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { XIcon } from "@phosphor-icons/react"

import { cn } from "../lib/utils"

// Strata's snackbar, on Base UI Toast. Kept next to sonner for now; apps pick one.
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return <Toast.Provider>{children}</Toast.Provider>
}

export function SnackbarViewport({ className }: { className?: string }) {
  return (
    <Toast.Viewport
      className={cn(
        "pointer-events-none absolute bottom-3 left-3 z-50 flex w-72 flex-col gap-2 outline-none",
        className
      )}
    >
      <SnackbarList />
    </Toast.Viewport>
  )
}

function SnackbarList() {
  const { toasts } = Toast.useToastManager()
  return (
    <>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          toast={t}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md outline-none",
            "transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
          )}
        >
          <Toast.Title className="flex-1">{t.title}</Toast.Title>
          <Toast.Action
            className={cn(
              "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
              "text-foreground/80 hover:bg-muted hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            )}
          />
          <Toast.Close
            aria-label="Dismiss"
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-sm",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            )}
          >
            <XIcon weight="bold" className="size-3" />
          </Toast.Close>
        </Toast.Root>
      ))}
    </>
  )
}

type ShowOptions = {
  message: string
  action?: { label: string; onClick: () => void }
  timeout?: number
}

// Must be called under a SnackbarProvider.
export function useSnackbar() {
  const manager = Toast.useToastManager()
  return {
    show: (opts: ShowOptions) =>
      manager.add({
        title: opts.message,
        timeout: opts.timeout ?? 5000,
        actionProps: opts.action
          ? { children: opts.action.label, onClick: opts.action.onClick }
          : undefined,
      }),
  }
}
