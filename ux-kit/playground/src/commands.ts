import { createElement, type ReactNode } from "react"
import { Icons, type ToolbarItemSpec } from "@preset.nz/ux-kit"

// The one command table. Ids are shared with the native menu (src-tauri/src/menu.rs):
// the toolbar renders from this table, the menu emits a `command` event with the same id,
// and `useMenuSync` pushes enabled and checked state back to the menu items.
// `edit.undo` and `edit.redo` run Rust-side from the menu; here they call the same
// rhizome commands, and their titles and gating come from rhizome's history.
// Accelerators live in menu.rs; `shortcut` here is the display string for tooltips.

export interface Command {
  id: string
  label: string
  icon: ReactNode
  shortcut?: string
  enabled: boolean
  disabledReason?: string
  /** Present for toggles. */
  pressed?: boolean
  run: () => void
}

export interface CommandContext {
  /** The selection (or the open document, with none) has values to reset. */
  canReset: boolean
  /** Why not, when it doesn't. */
  resetReason: string
  undoLabel: string | null
  redoLabel: string | null
  leftOpen: boolean
  rightOpen: boolean
  dark: boolean
  reset: () => void
  undo: () => void
  redo: () => void
  toggleLeft: () => void
  toggleRight: () => void
  toggleTheme: () => void
}

const icon = (name: keyof typeof Icons, className?: string) =>
  createElement(Icons[name] as React.ComponentType<{ className?: string }>, { className })

export function buildCommands(c: CommandContext): Command[] {
  return [
    {
      id: "panel.left",
      label: "Outline",
      icon: icon("SidebarSimpleIcon"),
      shortcut: "⌥⌘S",
      enabled: true,
      pressed: c.leftOpen,
      run: c.toggleLeft,
    },
    {
      id: "panel.right",
      label: "Inspector",
      icon: icon("SidebarSimpleIcon", "-scale-x-100"),
      shortcut: "⌥⌘I",
      enabled: true,
      pressed: c.rightOpen,
      run: c.toggleRight,
    },
    {
      id: "doc.reset",
      label: "Reset",
      icon: icon("EraserIcon"),
      shortcut: "⌥⌘R",
      enabled: c.canReset,
      disabledReason: c.resetReason,
      run: c.reset,
    },
    {
      id: "edit.undo",
      label: c.undoLabel ? `Undo ${c.undoLabel}` : "Undo",
      icon: icon("ArrowCounterClockwiseIcon"),
      shortcut: "⌘Z",
      enabled: c.undoLabel !== null,
      disabledReason: "Nothing to undo",
      run: c.undo,
    },
    {
      id: "edit.redo",
      label: c.redoLabel ? `Redo ${c.redoLabel}` : "Redo",
      icon: icon("ArrowClockwiseIcon"),
      shortcut: "⇧⌘Z",
      enabled: c.redoLabel !== null,
      disabledReason: "Nothing to redo",
      run: c.redo,
    },
    {
      id: "view.theme",
      label: c.dark ? "Light mode" : "Dark mode",
      icon: icon(c.dark ? "SunIcon" : "MoonIcon"),
      shortcut: "⇧⌘L",
      enabled: true,
      run: c.toggleTheme,
    },
  ]
}

/** The toolbar is a subset of the menu: these ids, in this order, in these groups. */
export const TOOLBAR = {
  leading: ["panel.left"],
  groups: [["doc.reset"], ["edit.undo", "edit.redo"], ["view.theme"]],
  trailing: ["panel.right"],
}

export function toItems(commands: Command[], ids: string[]): ToolbarItemSpec[] {
  return ids.flatMap((id) => {
    const c = commands.find((x) => x.id === id)
    if (!c) return []
    const { run: _run, ...spec } = c
    return [spec]
  })
}
