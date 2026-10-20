import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import type * as React from "react"
import { cn } from "../lib/utils"
import { DialogFooter, DialogHeader, DialogOverlay } from "./dialog"

// AlertShell: the markup ConfirmDialog and DownloadPrompt share. Internal, not
// exported from the package. It is answered, not dismissed: no close "x", and a
// click outside does nothing, so the footer buttons and Escape are the ways out.

interface AlertShellProps {
  open: boolean
  /** Escape. The caller decides what that means (and may ignore it). */
  onDismiss: () => void
  title: string
  /** The body, below the title. */
  children?: React.ReactNode
  /** The buttons, secondary first and primary last. */
  footer: React.ReactNode
  /** The element that takes focus when the dialog opens. */
  initialFocus?: React.RefObject<HTMLElement | null>
}

function AlertShell({ open, onDismiss, title, children, footer, initialFocus }: AlertShellProps) {
  return (
    <AlertDialogPrimitive.Root
      data-slot="confirm-dialog"
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <AlertDialogPrimitive.Portal data-slot="confirm-dialog-portal">
        <DialogOverlay />
        <AlertDialogPrimitive.Popup
          data-slot="confirm-dialog-content"
          initialFocus={initialFocus}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <DialogHeader>
            <AlertDialogPrimitive.Title
              data-slot="dialog-title"
              className="font-heading leading-none font-medium"
            >
              {title}
            </AlertDialogPrimitive.Title>
            {children ? (
              <AlertDialogPrimitive.Description
                render={<div />}
                data-slot="dialog-description"
                className="text-sm text-muted-foreground"
              >
                {children}
              </AlertDialogPrimitive.Description>
            ) : null}
          </DialogHeader>
          <DialogFooter>{footer}</DialogFooter>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export type { AlertShellProps }
export { AlertShell }
