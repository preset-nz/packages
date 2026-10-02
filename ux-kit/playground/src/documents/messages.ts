/** The two toast systems the kit carries, and what is true of each (read from the kit source). */
export interface ToastSystem {
  id: "snackbar" | "sonner"
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
    tagline: "Strata's, on Base UI Toast",
    facts: [
      { k: "library", v: "Base UI Toast" },
      { k: "dependency", v: "@base-ui/react (already the kit's base)" },
      { k: "api", v: "useSnackbar().show({ message, kind, action, … }) from a hook" },
      { k: "styling", v: "Tailwind classes on our own markup" },
      { k: "mount", v: "SnackbarProvider + SnackbarViewport" },
      { k: "used by", v: "Strata: useMoveToTrash, shown from two components (App, LibrarySheet)" },
    ],
    notes: [
      "Our markup and our classes, so tokens, radius and kinds are ours to set.",
      "A hook under a provider: no global call, no imports from outside React.",
      "Stacking, swipe and timers come from Base UI; the kit adds none of its own.",
    ],
  },
  {
    id: "sonner",
    label: "Sonner",
    tagline: "Third-party, imperative",
    facts: [
      { k: "library", v: "sonner 2.0" },
      { k: "dependency", v: "sonner (the kit's only third-party toast package)" },
      { k: "api", v: "toast(), toast.success() / .warning() / .error(), anywhere" },
      { k: "styling", v: "CSS variables (--normal-*), classNames, its own default stylesheet" },
      { k: "mount", v: "<Toaster /> once" },
      { k: "used by", v: "Oblique mounts <Toaster /> in Layout and calls toast() from export, fonts and layer code" },
    ],
    notes: [
      "A global function, so any module can fire one without a hook.",
      "Stacks and expands on hover by itself, and has loading and promise toasts.",
      "Its stylesheet wins over plain classes, so retheming past the variables needs !important.",
    ],
  },
]

export const system = (id: string) => SYSTEMS.find((s) => s.id === id)
