import { Icons } from "@preset.nz/ux-kit"
import type { Binding, ToolbarLayout } from "@preset.nz/app-kit"

// The playground's half of the command table. Ids, labels and accelerators are declared in
// Rust (src-tauri/src/menu.rs) and reach the toolbar through app-kit's `useCommands`; this file
// binds what each id does, its icon and its gating. Undo and redo (`edit.*`) are app-kit's:
// only their icons are bound here, and their titles and gating come from the history.

export interface CommandContext {
  /** The selection (or the open document, with none) has values to reset. */
  canReset: boolean
  /** Why not, when it doesn't. */
  resetReason: string
  leftOpen: boolean
  rightOpen: boolean
  dark: boolean
  reset: () => void
  toggleLeft: () => void
  toggleRight: () => void
  toggleTheme: () => void
}

export function buildBindings(c: CommandContext): Record<string, Binding> {
  return {
    "panel.left": { icon: <Icons.SidebarSimpleIcon />, pressed: c.leftOpen, run: c.toggleLeft },
    "panel.right": {
      icon: <Icons.SidebarSimpleIcon className="-scale-x-100" />,
      pressed: c.rightOpen,
      run: c.toggleRight,
    },
    "doc.reset": {
      icon: <Icons.EraserIcon />,
      enabled: c.canReset,
      disabledReason: c.resetReason,
      run: c.reset,
    },
    "edit.undo": { icon: <Icons.ArrowCounterClockwiseIcon /> },
    "edit.redo": { icon: <Icons.ArrowClockwiseIcon /> },
    "view.theme": {
      label: c.dark ? "Light mode" : "Dark mode",
      icon: c.dark ? <Icons.SunIcon /> : <Icons.MoonIcon />,
      run: c.toggleTheme,
    },
  }
}

/** The toolbar is a subset of the menu: these ids, in this order, in these groups. */
export const TOOLBAR: ToolbarLayout = {
  leading: ["panel.left"],
  groups: [["doc.reset"], ["edit.undo", "edit.redo"], ["view.theme"]],
  trailing: ["panel.right"],
}
