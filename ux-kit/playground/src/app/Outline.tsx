import { cn, EmptyState, SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import { docInfo } from "../documents"
import type { Row } from "../rhizome"

/** The rhizome tree as an outline: one row per document. Selection is by node id. */
export function Outline({
  docs,
  selectedId,
  onSelect,
}: {
  docs: Row[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <SidePanelHeader>Outline</SidePanelHeader>
      <SidePanelContent className="p-1">
        {docs.length === 0 ? (
          <EmptyState title="No documents" description="The tree has none." className="p-4" />
        ) : (
          <ul role="listbox" aria-label="Documents" className="flex flex-col gap-0.5">
            {docs.map((d) => {
              const info = docInfo(d.type)
              const selected = d.id === selectedId
              return (
                <li key={d.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => onSelect(d.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm",
                      selected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    {info && <info.Icon weight={selected ? "fill" : "regular"} className="size-4 shrink-0" />}
                    <span className="truncate">{info?.label ?? d.name}</span>
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
