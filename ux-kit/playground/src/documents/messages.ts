/** The kit's toast, and what is true of it (read from the kit source). */
export interface ToastSystem {
  id: "snackbar"
  label: string
  /** One-line summary under the column title. */
  tagline: string
  facts: { k: string; v: string }[]
  /** What is native to it, briefly. */
  notes: string[]
}

export const SYSTEMS: ToastSystem[] = [
  {
    id: "snackbar",
    label: "Snackbar",
    tagline: "The kit's one toast, on Base UI Toast",
    facts: [
      { k: "library", v: "Base UI Toast" },
      { k: "dependency", v: "@base-ui/react (already the kit's base)" },
      { k: "api", v: "useSnackbar().show({ message, kind, description, action, persistent, timeout }), dismiss(id?)" },
      { k: "outside React", v: "notify(opts) and dismissNotification(id?), through a module-level toast manager" },
      { k: "styling", v: "Tailwind classes on our own markup, from the kit's tokens" },
      { k: "mount", v: "SnackbarProvider once, SnackbarViewport inside it" },
      { k: "used by", v: "Strata (useMoveToTrash), this playground (Reset, with Undo)" },
    ],
    notes: [
      "Our markup and our classes, so tokens, radius and kinds are ours to set.",
      "useSnackbar under a provider, or notify() from a command handler, store or listener.",
      "Stacking, swipe and timers come from Base UI; the kit adds none of its own.",
    ],
  },
]

export const system = (id: string) => SYSTEMS.find((s) => s.id === id)
