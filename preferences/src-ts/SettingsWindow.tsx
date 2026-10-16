// The Cmd+, window. An app passes its title and mounts this once; the schema
// comes from the crate, the fields from facets, the values from the store.
// Saves on every change, no Save button. Escape closes.
//
// A schema with pages gets a row of tabs under the title (ux-kit's Tabs, via
// the app's `@/components/ui/tabs`); one without gets none. On each page the advanced sections sit behind a closed disclosure at
// the foot, so the first view is the short list most people need.
//
// It draws its own modal shell rather than importing a dialog primitive,
// because the apps do not all ship one and the shell is a few lines of
// Tailwind on the same tokens facets already assumes.

import { PropertyPanel, registerBuiltinRenderers, registerScope } from "@preset.nz/facets"
import { type ReactNode, useEffect, useMemo, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PrefSection, PrefValue, Snapshot } from "./api"
import {
  CHANGED_MARK,
  hasAnyChanges,
  helpFor,
  type PageView,
  pageViews,
  sectionHasChanges,
  sectionsHaveChanges,
  toPropertySchema,
} from "./facets-bridge"
import { registerPreferenceRenderers } from "./renderers"
import { usePreferenceActions, usePreferences } from "./store"
import { usePersistedState } from "./use-persisted-state"

const SCOPE = "preferences"
const ADVANCED_SCOPE = "preferences.advanced"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Window title. Defaults to "Settings". */
  title?: string
  /** Called when the window mounts and unmounts while open, for apps that track overlays. */
  onOverlay?: () => () => void
  /**
   * `<app>.settings`, say. When given, the open tab and each page's Advanced
   * disclosure survive a relaunch (via `usePersistedState`). Without it they
   * reset with the window's mount.
   */
  persistKey?: string
  /** An icon per page id, drawn above the tab's label. Pages without one show the label only. */
  icons?: Record<string, ReactNode>
}

export function SettingsWindow({
  open,
  onOpenChange,
  title = "Settings",
  onOverlay,
  persistKey,
  icons,
}: Props) {
  const snap = usePreferences()
  const { set, reset } = usePreferenceActions()
  const panelRef = useRef<HTMLDivElement>(null)

  const views = useMemo(() => (snap ? pageViews(snap) : []), [snap])
  const [tab, setTab] = usePersistedState<string | null>(
    persistKey ? `${persistKey}.tab` : null,
    null,
  )
  const [expanded, setExpanded] = usePersistedState<Record<string, boolean>>(
    persistKey ? `${persistKey}.advanced` : null,
    {},
  )
  // A remembered tab the schema no longer has falls back to the first page.
  const current: PageView | undefined = views.find((v) => v.page.id === tab) ?? views[0]
  const advancedOpen = current ? (expanded[current.page.id] ?? false) : false

  useEffect(() => {
    registerBuiltinRenderers()
    registerPreferenceRenderers()
  }, [])
  // The scopes are registered during render, not in an effect: PropertyPanel
  // reads its scope as it renders, so an effect would leave a newly selected
  // tab showing the previous page until something else re-rendered.
  // Registering is an idempotent write to facets' module map. `write` closes
  // over the latest `set`.
  useMemo(() => {
    const write = (path: string, value: unknown) => {
      void set(path, value as PrefValue).catch((e) => console.error("preferences: set failed:", e))
    }
    const read = (s: Snapshot) => s.values
    const empty = { version: 0, groups: [] }
    registerScope<Snapshot, Record<string, PrefValue>>(SCOPE, {
      schema: snap && current ? toPropertySchema(snap, current.basic) : empty,
      read,
      write,
    })
    registerScope<Snapshot, Record<string, PrefValue>>(ADVANCED_SCOPE, {
      schema: snap && current ? toPropertySchema(snap, current.advanced) : empty,
      read,
      write,
    })
  }, [snap, current, set])

  useEffect(() => {
    if (!open) return
    const release = onOverlay?.()
    const onKey = (e: globalThis.KeyboardEvent) => {
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

  if (!open) return null

  const shown: PrefSection[] = current
    ? advancedOpen
      ? [...current.basic, ...current.advanced]
      : current.basic
    : []

  // The page: its basic sections, the Advanced row, and the help and resets
  // for whatever is in view. With pages it sits in the selected tab's panel.
  const body =
    !snap || !current ? (
      <p className="p-4 text-xs text-muted-foreground">Loading…</p>
    ) : (
      <>
        <PropertyPanel scopeKey={SCOPE} selection={snap} ctx={snap} />
        {current.advanced.length > 0 && (
          <AdvancedDisclosure
            open={advancedOpen}
            changed={sectionsHaveChanges(snap, current.advanced)}
            onToggle={() => setExpanded((prev) => ({ ...prev, [current.page.id]: !advancedOpen }))}
          >
            <PropertyPanel scopeKey={ADVANCED_SCOPE} selection={snap} ctx={snap} />
          </AdvancedDisclosure>
        )}
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3 empty:hidden">
          {shown.map((s) => (
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
    )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a pointer shortcut; Escape closes from the keyboard
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
        {snap && current && views.length > 1 ? (
          <Tabs
            value={current.page.id}
            onValueChange={(page) => setTab(String(page))}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList
              variant="line"
              activateOnFocus
              aria-label="Settings pages"
              className="w-full shrink-0 gap-1 rounded-none border-b border-border px-2 pt-1.5 pb-2 group-data-[orientation=horizontal]/tabs:h-auto"
            >
              {views.map(({ page, basic, advanced }) => (
                <TabsTrigger
                  key={page.id}
                  value={page.id}
                  className="h-auto min-w-14 flex-none flex-col gap-0.5 px-2 py-1 text-[11px]"
                >
                  {icons?.[page.id] && (
                    <span aria-hidden="true" className="flex size-5 items-center justify-center">
                      {icons[page.id]}
                    </span>
                  )}
                  <span>
                    {page.label}
                    {sectionsHaveChanges(snap, [...basic, ...advanced]) && CHANGED_MARK}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={current.page.id} className="overflow-y-auto">
              {body}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto">{body}</div>
        )}
        <footer className="flex h-8 shrink-0 items-center border-t border-border px-4">
          <span className="select-text truncate font-mono text-[10px] text-muted-foreground">
            {snap?.path}
          </span>
        </footer>
      </div>
    </div>
  )
}

/**
 * The foot of a page: closed, one quiet row; open, the advanced sections in
 * place. Drawn like a facets collapsible group header (same chevron, same
 * title type) so the window has one kind of fold. It is not a facets group
 * because it folds several sections at once. A closed disclosure hiding a
 * changed value carries the changed mark, so nothing set is ever out of
 * sight without a sign.
 */
function AdvancedDisclosure({
  open,
  changed,
  onToggle,
  children,
}: {
  open: boolean
  changed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-t border-border">
      <h3 className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 px-1 pb-3 text-left uppercase hover:text-foreground"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Advanced
          {changed && !open && CHANGED_MARK}
        </button>
      </h3>
      {open && children}
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
