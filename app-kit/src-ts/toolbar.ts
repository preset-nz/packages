import type { ToolbarItemSpec } from "@preset.nz/ux-kit"

import type { Command } from "./commands"

// The ux-kit half of the command wiring. Kept apart from `commands.ts` so the `./core` entry
// never reaches ux-kit, for apps that only use the menu half (Strata, Fault).

/**
 * Several tools behind one toolbar button, for a family of tools that would crowd the bar. The
 * button shows the active one's icon (else the first's) and is pressed while one is active;
 * it opens a menu of them. Each stays a command in the menu bar.
 */
export interface ToolbarFlyout {
  /** The button's own id, not a command. */
  id: string
  label: string
  items: string[]
}

/** The toolbar is a subset of the commands: these ids, in this order, in these groups. */
export interface ToolbarLayout {
  leading?: string[]
  groups: (string | ToolbarFlyout)[][]
  trailing?: string[]
}

function flyout(commands: Command[], f: ToolbarFlyout): ToolbarItemSpec[] {
  const items = f.items.flatMap((id) => commands.find((x) => x.id === id) ?? [])
  if (items.length === 0) return []
  const active = items.find((c) => c.pressed)
  const shown = active ?? items[0]
  return [
    {
      id: f.id,
      label: active ? `${f.label}: ${active.label}` : f.label,
      icon: shown.icon,
      shortcut: active?.shortcut,
      enabled: items.some((c) => c.enabled !== false),
      pressed: active !== undefined,
      menu: items.map((c) => ({
        id: c.id,
        label: c.label,
        icon: c.icon,
        shortcut: c.shortcut,
        enabled: c.enabled,
        pressed: c.pressed,
      })),
    },
  ]
}

export function toItems(
  commands: Command[],
  ids: (string | ToolbarFlyout)[] = [],
): ToolbarItemSpec[] {
  return ids.flatMap((id) => {
    if (typeof id !== "string") return flyout(commands, id)
    const c = commands.find((x) => x.id === id)
    if (!c) return []
    return [
      {
        id: c.id,
        label: c.label,
        icon: c.icon,
        shortcut: c.shortcut,
        enabled: c.enabled,
        disabledReason: c.disabledReason,
        pressed: c.pressed,
      },
    ]
  })
}
