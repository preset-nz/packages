import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { DialogFooter, DialogHeader, DialogOverlay } from "./dialog"

// ConfirmDialog: ask before something that can't be taken back. Controlled
// only; the caller owns `open`. It is answered, not dismissed: no close "x",
// and a click outside does nothing, so Cancel and Escape are the ways out.

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The body: text, or a node (a list of apps, a size). */
  children?: React.ReactNode
  /** What the action is called: "Remove", never "OK". */
  confirmLabel: string
  /** Defaults to "Cancel". */
  cancelLabel?: string
  /** Confirm uses the destructive Button variant and initial focus is Cancel. */
  destructive?: boolean
  /** While a returned promise is pending the dialog stays open; a rejection keeps it open. */
  onConfirm: () => void | Promise<void>
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  // Nothing closes the dialog while the action runs.
  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (pending) return
    setPending(true)
    try {
      await onConfirm()
    } catch {
      // The caller shows its own failure; the dialog stays open.
      setPending(false)
      return
    }
    setPending(false)
    onOpenChange(false)
  }

  return (
    <AlertDialogPrimitive.Root
      data-slot="confirm-dialog"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogPrimitive.Portal data-slot="confirm-dialog-portal">
        <DialogOverlay />
        <AlertDialogPrimitive.Popup
          data-slot="confirm-dialog-content"
          initialFocus={destructive ? cancelRef : confirmRef}
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
          <DialogFooter>
            <AlertDialogPrimitive.Close
              ref={cancelRef}
              disabled={pending}
              render={<Button variant="outline" />}
            >
              {cancelLabel}
            </AlertDialogPrimitive.Close>
            <Button
              ref={confirmRef}
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              focusableWhenDisabled
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export type { ConfirmDialogProps }
export { ConfirmDialog }
