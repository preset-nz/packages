import * as React from "react"
import { AlertShell } from "./alert-shell"
import { Button } from "./button"

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
    <AlertShell
      open={open}
      onDismiss={() => handleOpenChange(false)}
      title={title}
      initialFocus={destructive ? cancelRef : confirmRef}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            focusableWhenDisabled
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </AlertShell>
  )
}

export type { ConfirmDialogProps }
export { ConfirmDialog }
