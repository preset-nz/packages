import { cn, EmptyState, SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import { docInfo } from "../documents"
import type { Row } from "../rhizome"
import type { Selection } from "../selection"

/**
 * The rhizome tree as an outline: one row per document, and under Card its layers. A click on a
 * document opens it; a click on a layer opens Card and selects the layer. The document row is
 * selected-styled while open; a layer row while it is the selected item.
 */
export function Outline({
  docs,
  layers,
  openId,
  selection,
  onOpen,
  onSelectLayer,
}: {
  docs: Row[]
  layers: Row[]
  openId: string | null
  selection: Selection
  onOpen: (id: string) => void
  onSelectLayer: (docId: string, layerId: string) => void
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
              const open = d.id === openId
              // The document row is the strong one only while no item inside it is selected.
              const strong = open && selection.kind === "none"
              return (
                <li key={d.id} role="option" aria-selected={open}>
                  <button
                    type="button"
                    onClick={() => onOpen(d.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm",
                      strong
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : open
                          ? "bg-sidebar-accent/50"
                          : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    {info && <info.Icon weight={open ? "fill" : "regular"} className="size-4 shrink-0" />}
                    <span className="truncate">{info?.label ?? d.name}</span>
                  </button>
                  {d.type === "card" && layers.length > 0 && (
                    <ul role="group" className="mt-0.5 flex flex-col gap-0.5 pl-6">
                      {layers.map((l) => {
                        const selected = selection.kind === "layer" && selection.id === l.id && open
                        return (
                          <li key={l.id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onClick={() => onSelectLayer(d.id, l.id)}
                              className={cn(
                                "flex w-full items-center rounded-sm px-2 py-0.5 text-left text-xs",
                                selected
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-muted-foreground hover:bg-sidebar-accent/50",
                              )}
                            >
                              <span className="truncate">{String(l.values?.name ?? l.name)}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </SidePanelContent>
    </>
  )
}
