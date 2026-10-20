// The Cmd+, window's content. Settings is its own native window
// (native-apps.md, "Settings is a window"): the app opens one and renders this
// in it, and this fills it edge to edge. The window's title bar carries the
// title, so there is none here. The schema comes from the crate, the fields,
// tabs and Advanced row from facets, the values from the store. Saves on
// every change, no Save button.
//
// facets draws the tabs through the app's `@/components/ui/tabs`, so a host
// with a paged schema provides it (ux-kit's Tabs).

import { PropertyPanel, registerBuiltinRenderers, registerScope } from "@preset.nz/facets"
import { useEffect, useMemo } from "react"
import type { PrefValue, Snapshot } from "./api"
import { changedPaths, type ExtraGroup, hasAnyChanges, toPropertySchema } from "./facets-bridge"
import { registerPreferenceRenderers } from "./renderers"
import { usePreferenceActions, usePreferences } from "./store"
import { usePersistedState } from "./use-persisted-state"

const SCOPE = "preferences"
const EMPTY = { version: 0, groups: [] }

type Props = {
  /** Escape was pressed. An app that wants Escape to close the window closes it here. */
  onClose?: () => void
  /**
   * `<app>.settings`, say. When given, the open tab and the open Advanced rows
   * survive a relaunch (via `usePersistedState`). Without it they reset with
   * the window.
   */
  persistKey?: string
  /**
   * Groups the app adds after the crate's sections, each on the page it names
   * (the first page by default). Their fields use a kind the app registered with
   * facets' `registerFieldRenderer` and carry no `path`, so they are never in the
   * TOML file, `changedPaths` or Reset all. Keep the array stable (module scope
   * or `useMemo`): a new one each render rebuilds the schema.
   */
  extraGroups?: ExtraGroup[]
}

export function SettingsWindow({ onClose, persistKey, extraGroups }: Props) {
  const snap = usePreferences()
  const { set, reset } = usePreferenceActions()

  const [page, setPage] = usePersistedState<string | null>(
    persistKey ? `${persistKey}.tab` : null,
    null,
  )
  // facets' shape, the ids of the pages whose Advanced row is open. A new key:
  // the first build stored a record here.
  const [advancedOpen, setAdvancedOpen] = usePersistedState<string[]>(
    persistKey ? `${persistKey}.advanced-pages` : null,
    [],
  )

  useEffect(() => {
    registerBuiltinRenderers()
    registerPreferenceRenderers()
  }, [])
  // Registered during render, not in an effect: PropertyPanel reads its scope
  // as it renders, so an effect would draw the previous values until something
  // else re-rendered. Registering is an idempotent write to facets' module map.
  useMemo(() => {
    registerScope<Snapshot, Record<string, PrefValue>>(SCOPE, {
      schema: snap ? toPropertySchema(snap, extraGroups) : EMPTY,
      read: (s) => s.values,
      write: (path, value) => {
        void set(path, value as PrefValue).catch((e) =>
          console.error("preferences: set failed:", e),
        )
      },
      changed: (s) => changedPaths(s),
    })
  }, [snap, set, extraGroups])

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {snap ? (
          <PropertyPanel
            scopeKey={SCOPE}
            selection={snap}
            ctx={snap}
            page={page ?? undefined}
            onPageChange={setPage}
            advancedOpen={advancedOpen}
            onAdvancedOpenChange={setAdvancedOpen}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">Loading…</p>
        )}
      </div>
      <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border px-3">
        <span className="min-w-0 flex-1 select-text truncate font-mono text-[10px] text-muted-foreground">
          {snap?.path}
        </span>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={!snap || !hasAnyChanges(snap)}
          className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          Reset all
        </button>
      </footer>
    </div>
  )
}
