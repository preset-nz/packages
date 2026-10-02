import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { CheckCircleIcon, WarningIcon, XCircleIcon, XIcon } from "@phosphor-icons/react"

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

export type SnackbarKind = "plain" | "success" | "warning" | "error"

// Colour per kind, from the kit's tokens. Warning fills with `--warning`; the others keep the
// popover surface and take the kind from the icon and a coloured leading edge.
const KIND: Record<SnackbarKind, { root: string; icon: React.ReactNode | null }> = {
  plain: { root: "", icon: null },
  success: {
    root: "border-l-2 border-l-primary",
    icon: <CheckCircleIcon weight="fill" className="mt-px size-4 shrink-0 text-primary" />,
  },
  warning: {
    root: "border-warning bg-warning text-warning-foreground",
    icon: <WarningIcon weight="fill" className="mt-px size-4 shrink-0" />,
  },
  error: {
    root: "border-l-2 border-l-destructive",
    icon: <XCircleIcon weight="fill" className="mt-px size-4 shrink-0 text-destructive" />,
  },
}

function SnackbarList() {
  const { toasts } = Toast.useToastManager()
  return (
    <>
      {toasts.map((t) => {
        const kind = KIND[(t.type as SnackbarKind | undefined) ?? "plain"] ?? KIND.plain
        return (
        <Toast.Root
          key={t.id}
          toast={t}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md outline-none",
            "transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            kind.root
          )}
        >
          {kind.icon}
          <div className="min-w-0 flex-1">
            <Toast.Title className="font-medium">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="mt-0.5 opacity-80">{t.description}</Toast.Description>
            )}
          </div>
          <Toast.Action
            className={cn(
              "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
              "text-current/80 hover:bg-foreground/10 hover:text-current",
              "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            )}
          />
          <Toast.Close
            aria-label="Dismiss"
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-sm",
              "opacity-60 hover:bg-foreground/10 hover:opacity-100",
              "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            )}
          >
            <XIcon weight="bold" className="size-3" />
          </Toast.Close>
        </Toast.Root>
        )
      })}
    </>
  )
}

type ShowOptions = {
  message: string
  /** A second line under the message. */
  description?: React.ReactNode
  /** Plain by default. */
  kind?: SnackbarKind
  action?: { label: string; onClick: () => void }
  /** Milliseconds before it goes; 5000 by default. */
  timeout?: number
  /** Stays until dismissed (`dismiss(id)` or its close button). Wins over `timeout`. */
  persistent?: boolean
}

// Must be called under a SnackbarProvider.
export function useSnackbar() {
  const manager = Toast.useToastManager()
  return {
    /** Returns the toast's id, for `dismiss`. */
    show: (opts: ShowOptions) =>
      manager.add({
        title: opts.message,
        description: opts.description,
        type: opts.kind ?? "plain",
        timeout: opts.persistent ? 0 : (opts.timeout ?? 5000),
        actionProps: opts.action
          ? { children: opts.action.label, onClick: opts.action.onClick }
          : undefined,
      }),
    /** One toast by id, or every toast with no id. */
    dismiss: (id?: string) => manager.close(id),
  }
}
