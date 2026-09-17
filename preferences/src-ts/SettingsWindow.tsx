// The Cmd+, window. An app passes its title and mounts this once; the schema
// comes from the crate, the fields from facets, the values from the store.
// Saves on every change, no Save button. Escape closes.
//
// It draws its own modal shell rather than importing a dialog primitive,
// because the apps do not all ship one and the shell is a few lines of
// Tailwind on the same tokens facets already assumes.

import { useEffect, useMemo, useRef } from "react"
import {
  PropertyPanel,
  registerBuiltinRenderers,
  registerScope,
} from "@preset.nz/facets"
import type { PrefValue, Snapshot } from "./api"
import {
  hasAnyChanges,
  helpFor,
  sectionHasChanges,
  toPropertySchema,
} from "./facets-bridge"
import { registerPreferenceRenderers } from "./renderers"
import { usePreferenceActions, usePreferences } from "./store"

const SCOPE = "preferences"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Window title. Defaults to "Settings". */
  title?: string
  /** Called when the window mounts and unmounts while open, for apps that track overlays. */
  onOverlay?: () => () => void
}

export function SettingsWindow({ open, onOpenChange, title = "Settings", onOverlay }: Props) {
  const snap = usePreferences()
  const { set, reset } = usePreferenceActions()
  const panelRef = useRef<HTMLDivElement>(null)

  // Registration is per-module; scope write closes over the latest `set`.
  useEffect(() => {
    registerBuiltinRenderers()
    registerPreferenceRenderers()
  }, [])
  useEffect(() => {
    registerScope<Snapshot, Record<string, PrefValue>>(SCOPE, {
      schema: snap ? toPropertySchema(snap) : { version: 0, groups: [] },
      read: (s) => s.values,
      write: (path, value) => {
        void set(path, value as PrefValue).catch((e) =>
          console.error("preferences: set failed:", e),
        )
      },
    })
  }, [snap, set])

  useEffect(() => {
    if (!open) return
    const release = onOverlay?.()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      release?.()
    }
  }, [open, onOpenChange, onOverlay])

  const sections = useMemo(() => snap?.schema.sections ?? [], [snap])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        className="flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-md border border-border bg-background shadow-lg"
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
          <h1 className="text-sm font-semibold">{title}</h1>
          <button
            type="button"
            onClick={() => void reset()}
            disabled={!snap || !hasAnyChanges(snap)}
            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Reset all
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {!snap ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              <PropertyPanel scopeKey={SCOPE} selection={snap} ctx={snap} />
              <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                {sections.map((s) => (
                  <SectionFooter
                    key={s.id}
                    label={s.label}
                    changed={sectionHasChanges(snap, s.id)}
                    help={helpFor(snap, s.id)}
                    onReset={() => void reset(s.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="flex h-8 shrink-0 items-center border-t border-border px-4">
          <span className="select-text truncate font-mono text-[10px] text-muted-foreground">
            {snap?.path}
          </span>
        </footer>
      </div>
    </div>
  )
}

function SectionFooter({
  label,
  changed,
  help,
  onReset,
}: {
  label: string
  changed: boolean
  help: Array<[string, string]>
  onReset: () => void
}) {
  if (!changed && help.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {changed && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Reset {label.toLowerCase()}
          </button>
        )}
      </div>
      {help.map(([l, h]) => (
        <p key={l} className="text-[11px] text-muted-foreground">
          <span className="text-foreground/80">{l}.</span> {h}
        </p>
      ))}
    </div>
  )
}
