import { cn, EmptyState, Icons, SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"

/** The rhizome tree as an outline: one row per note, indented by depth. Selection is by node id. */
export function Outline({
  notes,
  selectedId,
  onSelect,
}: {
  notes: Row[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <SidePanelHeader>Outline</SidePanelHeader>
      <SidePanelContent className="p-1">
        {notes.length === 0 ? (
          <EmptyState title="No notes" description="Add one from the toolbar." className="p-4" />
        ) : (
          <ul role="listbox" aria-label="Notes" className="flex flex-col gap-0.5">
            {notes.map((n) => {
              const depth = n.path.split("/").length - 3
              const selected = n.id === selectedId
              return (
                <li key={n.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    style={{ paddingLeft: 8 + depth * 14 }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left text-sm",
                      selected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    <Icons.NoteIcon weight={selected ? "fill" : "regular"} className="size-4 shrink-0" />
                    <span className="truncate">{n.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SidePanelContent>
    </>
  )
}
