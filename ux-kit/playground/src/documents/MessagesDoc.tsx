import { Button, dismissNotification, notify, useSnackbar } from "@preset.nz/ux-kit"
import { useRef } from "react"

import { selectSystem, useSelection } from "../selection"
import { DOC_PAGE, DocHeader } from "./Header"
import { SYSTEMS, type ToastSystem } from "./messages"
import { Selectable } from "./Selectable"

/** What each button does. */
interface Fire {
  plain(): void
  success(): void
  warning(): void
  error(): void
  action(): void
  burst(): void
  persistent(): void
  dismiss(): void
  notify(): void
}

const LONG_ERROR = {
  title: "Export failed",
  detail: "The destination is read-only. Choose another folder, or check the volume's permissions.",
}

function useSnackbarFire(): Fire {
  const snackbar = useSnackbar()
  const persistentId = useRef<string | null>(null)
  return {
    plain: () => snackbar.show({ message: "Exported 3 layers" }),
    success: () => snackbar.show({ message: "Exported 3 layers", kind: "success" }),
    warning: () => snackbar.show({ message: "Layer names are long", kind: "warning" }),
    error: () =>
      snackbar.show({ message: LONG_ERROR.title, description: LONG_ERROR.detail, kind: "error" }),
    action: () =>
      snackbar.show({
        message: "Removed Shadow",
        action: { label: "Undo", onClick: () => snackbar.show({ message: "Restored Shadow" }) },
      }),
    burst: () =>
      [1, 2, 3, 4].forEach((n) => {
        setTimeout(() => snackbar.show({ message: `Message ${n} of 4` }), n * 120)
      }),
    persistent: () => {
      if (persistentId.current) snackbar.dismiss(persistentId.current)
      persistentId.current = snackbar.show({ message: "Stays until dismissed", persistent: true })
    },
    dismiss: () => {
      if (persistentId.current) snackbar.dismiss(persistentId.current)
      persistentId.current = null
    },
    // No hook: the same snackbar, raised the way a command handler or a store would.
    notify: () => {
      const id = notify({
        message: "Raised with notify()",
        description: "From plain code, outside React.",
        kind: "success",
      })
      setTimeout(() => dismissNotification(id), 3000)
    },
  }
}

function Column({ sys, fire }: { sys: ToastSystem; fire: Fire }) {
  const selection = useSelection()
  const buttons: [string, () => void][] = [
    ["Plain", fire.plain],
    ["Success", fire.success],
    ["Warning", fire.warning],
    ["Error, two lines", fire.error],
    ["With Undo action", fire.action],
    ["Burst of four", fire.burst],
    ["Persistent", fire.persistent],
    ["Dismiss persistent", fire.dismiss],
    ["notify() outside React", fire.notify],
  ]
  return (
    <Selectable
      as="section"
      selected={selection.kind === "system" && selection.id === sys.id}
      onSelect={() => selectSystem(sys.id)}
      className="flex flex-col gap-4 border border-border bg-card p-4"
    >
      <header>
        <h2 className="font-heading text-xl font-semibold">{sys.label}</h2>
        <p className="text-xs text-muted-foreground">{sys.tagline}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {buttons.map(([label, run]) => (
          <Button key={label} variant="outline" size="sm" onClick={run}>
            {label}
          </Button>
        ))}
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
        {sys.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Selectable>
  )
}

/** The snackbar showcase. Its viewport sits bottom-right above the status bar. */
export function MessagesDoc() {
  const snackbar = useSnackbarFire()
  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Messages">
        The kit's one toast, the snackbar. Fire each kind and watch where it lands, how they stack
        and how they look. Select the panel for its facts.
      </DocHeader>
      <div className="p-1">
        <Column sys={SYSTEMS[0]} fire={snackbar} />
      </div>
    </div>
  )
}
