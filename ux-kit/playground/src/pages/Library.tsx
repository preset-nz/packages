import {
  Button,
  CARD_SIZE,
  CardGrid,
  LibraryHeader,
  LibraryStatusBar,
  QuickView,
  Rail,
  RailRow,
  RailSection,
  RailSort,
  SidePanel,
  usePanelState,
} from "@preset.nz/ux-kit"
import { useMemo, useState } from "react"

import { useStored } from "../stored"

// The library shell: header, two spine panels, a card grid, a status bar with
// the card-size slider, and quick view (Space on a card). A pretend catalogue.

type Item = { key: string; name: string; hue: number; aspect: number }
type SortKey = "name" | "shape"

const ITEMS: Item[] = Array.from({ length: 600 }, (_, i) => ({
  key: `item-${i}`,
  name: `frame-${String(i).padStart(4, "0")}`,
  hue: (i * 37) % 360,
  aspect: [1, 1.5, 0.75][i % 3],
}))

const SORTS = [
  { key: "name", label: "Name" },
  { key: "shape", label: "Shape" },
] as const

const LEFT = { min: 180, max: 420, default: 240 }
const RIGHT = { min: 220, max: 480, default: 288 }

/** A stand-in for a picture: a flat swatch with the item's shape. */
function Swatch({ item, className }: { item: Item; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: `oklch(0.7 0.12 ${item.hue})`,
        aspectRatio: String(item.aspect),
      }}
    />
  )
}

export function LibraryPage() {
  const [left, setLeft] = useStored("library.left", { width: LEFT.default, collapsed: false })
  const [right, setRight] = useStored("library.right", { width: RIGHT.default, collapsed: false })
  const leftPanel = usePanelState([left, setLeft], LEFT)
  const rightPanel = usePanelState([right, setRight], RIGHT)
  const [cardSize, setCardSize] = useState<number>(CARD_SIZE.default)
  const [sort, setSort] = useState<SortKey>("name")
  const [direction, setDirection] = useState<"asc" | "desc">("asc")
  const [railOpen, setRailOpen] = useState({ sort: true, shapes: true })
  const [shape, setShape] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [quick, setQuick] = useState<number | null>(null)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = ITEMS.filter(
      (i) => (shape === null || i.aspect === shape) && (!q || i.name.includes(q)),
    )
    const sign = direction === "asc" ? 1 : -1
    return [...list].sort((a, b) =>
      sort === "name" ? sign * a.name.localeCompare(b.name) : sign * (a.aspect - b.aspect),
    )
  }, [search, shape, sort, direction])

  const count = (a: number) => ITEMS.filter((i) => i.aspect === a).length

  return (
    <div className="-m-6 flex h-[calc(100vh)] flex-col">
      <LibraryHeader
        title="Library"
        summary={
          <span className="text-xs text-muted-foreground">
            {shown.length.toLocaleString()} of {ITEMS.length.toLocaleString()}
          </span>
        }
        left={{
          collapsed: !leftPanel.open,
          onToggle: leftPanel.toggle,
          label: "filters panel",
          shortcut: "[",
        }}
        right={{
          collapsed: !rightPanel.open,
          onToggle: rightPanel.toggle,
          label: "properties panel",
          shortcut: "]",
        }}
        search={{
          value: search,
          onChange: setSearch,
          label: "Search the library",
          placeholder: "Search names",
        }}
      >
        <Button size="sm" variant="outline">
          Add
        </Button>
      </LibraryHeader>
      <div className="flex min-h-0 flex-1">
        <SidePanel
          side="left"
          title="Filters"
          icon={null}
          spine
          className="border-border bg-card/40"
          {...leftPanel.panelProps}
        >
          <Rail>
            <RailRow
              variant="nav"
              label="Library"
              count={ITEMS.length}
              selected
              onClick={() => setShape(null)}
            />
            <RailSection
              id="sort"
              title="Sort"
              collapsed={!railOpen.sort}
              onToggle={() => setRailOpen((p) => ({ ...p, sort: !p.sort }))}
              summary={`${sort} ${direction === "asc" ? "↑" : "↓"}`}
            >
              <RailSort
                value={sort}
                onValueChange={setSort}
                options={SORTS}
                direction={direction}
                onDirectionToggle={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
              />
            </RailSection>
            <RailSection
              id="shapes"
              title="Shape"
              collapsed={!railOpen.shapes}
              onToggle={() => setRailOpen((p) => ({ ...p, shapes: !p.shapes }))}
              summary={shape === null ? undefined : 1}
            >
              {[1, 1.5, 0.75].map((a) => (
                <RailRow
                  key={a}
                  label={a === 1 ? "Square" : a > 1 ? "Landscape" : "Portrait"}
                  count={count(a)}
                  selected={shape === a}
                  onClick={() => setShape(shape === a ? null : a)}
                />
              ))}
            </RailSection>
          </Rail>
        </SidePanel>
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <CardGrid
            items={shown}
            cellSize={cardSize}
            renderCell={(item, index) => (
              <button
                type="button"
                onClick={() => setQuick(index)}
                className="flex h-full w-full flex-col gap-1 text-left"
              >
                <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-sm bg-muted/30">
                  <Swatch item={item} className="max-h-full max-w-full" />
                </span>
                <span className="truncate text-[10px] text-muted-foreground">{item.name}</span>
              </button>
            )}
            emptyLabel="Nothing matches."
          />
        </main>
        <SidePanel
          side="right"
          title="Properties"
          icon={null}
          spine
          className="border-border bg-card/40"
          {...rightPanel.panelProps}
        >
          <p className="p-3 text-xs text-muted-foreground">
            The app's inspector goes here. Drag the edge to resize, double-click it to reset.
          </p>
        </SidePanel>
      </div>
      <LibraryStatusBar cardSize={cardSize} onCardSizeChange={setCardSize} />
      {quick !== null && (
        <QuickView
          items={shown}
          index={Math.min(quick, shown.length - 1)}
          onClose={() => setQuick(null)}
          onIndexChange={setQuick}
          title={(i) => i.name}
          renderItem={(i) => <Swatch item={i} className="max-h-full w-96 max-w-full shadow-2xl" />}
        />
      )}
    </div>
  )
}
