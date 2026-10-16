import { cn, EmptyState, SidePanelContent } from "@preset.nz/ux-kit"

import { docInfo } from "../documents"
import { opKind } from "../documents/ops"
import type { Row } from "../rhizome"
import type { Selection } from "../selection"

/**
 * The rhizome tree as an outline: one row per document, under Card its layers, under Ops its stack. A click on a
 * document opens it; a click on a layer opens Card and selects the layer. The document row is
 * selected-styled while no item inside it is selected; a layer row while it is the selected item.
 */
export function Outline({
  docs,
  layers,
  ops,
  openId,
  selection,
  onOpen,
  onSelectLayer,
  onSelectOp,
}: {
  docs: Row[]
  layers: Row[]
  ops: Row[]
  openId: string | null
  selection: Selection
  onOpen: (id: string) => void
  onSelectLayer: (docId: string, layerId: string) => void
  onSelectOp: (docId: string, opId: string) => void
}) {
  return (
    <SidePanelContent className="p-1">
      {docs.length === 0 ? (
        <EmptyState title="No documents" description="The tree has none." className="p-4" />
      ) : (
        <ul aria-label="Documents" className="flex flex-col gap-0.5">
          {docs.map((d) => {
            const info = docInfo(d.type)
            const open = d.id === openId
            // The document row is the strong one only while no item inside it is selected.
            const strong = open && selection.kind === "none"
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpen(d.id)}
                  aria-current={open || undefined}
                  className={cn(
                    "selectable flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !strong && (open ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent/50"),
                  )}
                  data-selected={strong || undefined}
                >
                  {info && (
                    <info.Icon weight={open ? "fill" : "regular"} className="size-4 shrink-0" />
                  )}
                  <span className="truncate">{info?.label ?? d.name}</span>
                </button>
                {d.type === "ops" && ops.length > 0 && (
                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-6">
                    {ops.map((o) => {
                      const selected = selection.kind === "op" && selection.id === o.id && open
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => onSelectOp(d.id, o.id)}
                            aria-current={selected || undefined}
                            className={cn(
                              "selectable flex w-full items-center rounded-sm px-2 py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              !selected && "text-muted-foreground hover:bg-sidebar-accent/50",
                            )}
                            data-selected={selected || undefined}
                          >
                            <span className="truncate">{opKind(o.type)?.label ?? o.name}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {d.type === "card" && layers.length > 0 && (
                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-6">
                    {layers.map((l) => {
                      const selected = selection.kind === "layer" && selection.id === l.id && open
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => onSelectLayer(d.id, l.id)}
                            aria-current={selected || undefined}
                            className={cn(
                              "selectable flex w-full items-center rounded-sm px-2 py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              !selected && "text-muted-foreground hover:bg-sidebar-accent/50",
                            )}
                            data-selected={selected || undefined}
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
  )
}
