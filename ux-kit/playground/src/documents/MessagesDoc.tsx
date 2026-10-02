import { useRef } from "react"
import { Button, toast, useSnackbar } from "@preset.nz/ux-kit"

import { selectSystem, useSelection } from "../selection"
import { DOC_PAGE, DocHeader } from "./Header"
import { Selectable } from "./Selectable"
import { SYSTEMS, type ToastSystem } from "./messages"

/** What each button does in one system. Same set of buttons, same texts, so the columns compare. */
interface Fire {
  plain(): void
  success(): void
  warning(): void
  error(): void
  action(): void
  burst(): void
  persistent(): void
  dismiss(): void
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
    error: () => snackbar.show({ message: LONG_ERROR.title, description: LONG_ERROR.detail, kind: "error" }),
    action: () =>
      snackbar.show({
        message: "Removed Shadow",
        action: { label: "Undo", onClick: () => snackbar.show({ message: "Restored Shadow" }) },
      }),
    burst: () => [1, 2, 3, 4].forEach((n) => setTimeout(() => snackbar.show({ message: `Message ${n} of 4` }), n * 120)),
    persistent: () => {
      if (persistentId.current) snackbar.dismiss(persistentId.current)
      persistentId.current = snackbar.show({ message: "Stays until dismissed", persistent: true })
    },
    dismiss: () => {
      if (persistentId.current) snackbar.dismiss(persistentId.current)
      persistentId.current = null
    },
  }
}

function useSonnerFire(): Fire {
  const persistentId = useRef<string | number | null>(null)
  return {
    plain: () => toast("Exported 3 layers"),
    success: () => toast.success("Exported 3 layers"),
    warning: () => toast.warning("Layer names are long"),
    error: () => toast.error(LONG_ERROR.title, { description: LONG_ERROR.detail }),
    action: () =>
      toast("Removed Shadow", {
        action: { label: "Undo", onClick: () => toast("Restored Shadow") },
      }),
    burst: () => [1, 2, 3, 4].forEach((n) => setTimeout(() => toast(`Message ${n} of 4`), n * 120)),
    persistent: () => {
      if (persistentId.current !== null) toast.dismiss(persistentId.current)
      persistentId.current = toast("Stays until dismissed", { duration: Infinity })
    },
    dismiss: () => {
      if (persistentId.current !== null) toast.dismiss(persistentId.current)
      persistentId.current = null
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

/** The kit's two toast systems side by side. Both viewports sit bottom-right above the status bar. */
export function MessagesDoc() {
  const snackbar = useSnackbarFire()
  const sonner = useSonnerFire()
  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Messages">
        The same eight messages in each toast system. Fire them and watch where they land, how they
        stack and how they look. Select a column for its facts.
      </DocHeader>
      <div className="grid gap-4 p-1 md:grid-cols-2">
        <Column sys={SYSTEMS[0]} fire={snackbar} />
        <Column sys={SYSTEMS[1]} fire={sonner} />
      </div>
    </div>
  )
}
