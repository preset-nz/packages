// The Cmd+, window. An app passes its title and mounts this once; the schema
// comes from the crate, the fields from facets, the values from the store.
// Saves on every change, no Save button. Escape closes.
//
// A schema with pages gets a row of tabs under the title; one without gets
// none. On each page the advanced sections sit behind a closed disclosure at
// the foot, so the first view is the short list most people need.
//
// It draws its own modal shell rather than importing a dialog primitive,
// because the apps do not all ship one and the shell is a few lines of
// Tailwind on the same tokens facets already assumes.

import { PropertyPanel, registerBuiltinRenderers, registerScope } from "@preset.nz/facets"
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef } from "react"
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

  // With tabs, the scrolling body is the selected tab's panel.
  const panelAttrs =
    current && views.length > 1
      ? {
          role: "tabpanel",
          id: tabPanelId(current.page.id),
          "aria-labelledby": tabId(current.page.id),
        }
      : {}

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
        {snap && views.length > 1 && current && (
          <Tabs
            snap={snap}
            views={views}
            current={current.page.id}
            icons={icons}
            onSelect={setTab}
          />
        )}
        <div className="flex-1 overflow-y-auto" {...panelAttrs}>
          {!snap || !current ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              <PropertyPanel scopeKey={SCOPE} selection={snap} ctx={snap} />
              {current.advanced.length > 0 && (
                <AdvancedDisclosure
                  open={advancedOpen}
                  changed={sectionsHaveChanges(snap, current.advanced)}
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [current.page.id]: !advancedOpen }))
                  }
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

const tabId = (page: string) => `preferences-tab-${page}`
const tabPanelId = (page: string) => `preferences-panel-${page}`

/**
 * The toolbar row: one tab per page, macOS-style. Arrow keys, Home and End
 * move between tabs and select as they go; only the selected tab is in the
 * Tab order. A page holding a changed value carries the changed mark.
 */
function Tabs({
  snap,
  views,
  current,
  icons,
  onSelect,
}: {
  snap: Snapshot
  views: PageView[]
  current: string
  icons?: Record<string, ReactNode>
  onSelect: (page: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = views.findIndex((v) => v.page.id === current)
    const next =
      e.key === "ArrowRight"
        ? (at + 1) % views.length
        : e.key === "ArrowLeft"
          ? (at - 1 + views.length) % views.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? views.length - 1
              : -1
    const view = views[next]
    if (!view) return
    e.preventDefault()
    onSelect(view.page.id)
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(view.page.id))}`)
      ?.focus()
  }
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Settings pages"
      onKeyDown={onKeyDown}
      className="flex shrink-0 items-end justify-center gap-1 border-b border-border px-2 py-1.5"
    >
      {views.map(({ page, basic, advanced }) => {
        const selected = page.id === current
        const changed = sectionsHaveChanges(snap, [...basic, ...advanced])
        const icon = icons?.[page.id]
        return (
          <button
            key={page.id}
            type="button"
            role="tab"
            id={tabId(page.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(page.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(page.id)}
            className={`flex min-w-14 flex-col items-center gap-0.5 rounded px-2 py-1 text-[11px] ${
              selected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {icon && (
              <span aria-hidden="true" className="flex size-5 items-center justify-center">
                {icon}
              </span>
            )}
            <span>
              {page.label}
              {changed && CHANGED_MARK}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The foot of a page: closed, one quiet row; open, the advanced sections in
 * place. A closed disclosure hiding a changed value carries the changed mark,
 * so nothing set is ever out of sight without a sign.
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
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span
          aria-hidden="true"
          className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
        Advanced
        {changed && !open && CHANGED_MARK}
      </button>
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
