import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, useState } from "react"

import { cn } from "../../lib/utils"

// A virtualised grid of equal cards. Only the rows in view are mounted, so a
// library of tens of thousands stays cheap. Cells are `cellSize` wide and
// `cellSize / aspect` tall, plus a caption strip; the card inside fills its
// cell, so what a thumbnail does with a different shape (letterbox, crop) is
// the card's call.

const GAP = 6

interface CardGridProps<T extends { key: string }> {
  items: readonly T[]
  renderCell: (item: T, index: number) => React.ReactNode
  /** Cell width in px; wire it to `CardSizeSlider`. */
  cellSize?: number
  /** Width over height of the picture area: 1 is square, 1.5 is landscape 3:2. */
  aspect?: number
  /** Height below the picture, for a caption or a row of marks. */
  captionHeight?: number
  emptyLabel?: React.ReactNode
  /** Called when the last rows come into view, to load the next page. */
  onEndReached?: () => void
  /** How many rows from the end count as "reached". */
  endReachedThresholdRows?: number
  className?: string
}

function CardGrid<T extends { key: string }>({
  items,
  renderCell,
  cellSize = 130,
  aspect = 1,
  captionHeight = 24,
  emptyLabel = "(none)",
  onEndReached,
  endReachedThresholdRows = 3,
  className,
}: CardGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [columns, setColumns] = useState(1)
  const cardH = Math.round(cellSize / aspect) + captionHeight

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const measure = () => {
      // The content box, less the rows' own side padding (GAP / 2 each side).
      const style = getComputedStyle(el)
      const content =
        el.clientWidth -
        (Number.parseFloat(style.paddingLeft) || 0) -
        (Number.parseFloat(style.paddingRight) || 0)
      const room = content - GAP
      setColumns(Math.max(1, Math.floor((room + GAP) / (cellSize + GAP))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cellSize])

  const rowCount = Math.ceil(items.length / columns)
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cardH + GAP,
    overscan: 6,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: the cell size and shape change the layout, so re-measure
  useEffect(() => {
    rowVirtualizer.measure()
  }, [cardH, rowVirtualizer])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastVirtualIndex = virtualItems[virtualItems.length - 1]?.index ?? -1
  useEffect(() => {
    if (!onEndReached || rowCount === 0) return
    if (lastVirtualIndex >= rowCount - endReachedThresholdRows) onEndReached()
  }, [lastVirtualIndex, rowCount, onEndReached, endReachedThresholdRows])

  return (
    <div
      ref={parentRef}
      data-slot="card-grid"
      className={cn(
        "min-h-[60px] flex-1 overflow-y-auto rounded-sm border border-border",
        className,
      )}
    >
      {items.length === 0 ? (
        <div className="p-2 text-xs text-muted-foreground/70">{emptyLabel}</div>
      ) : (
        <div style={{ height: rowVirtualizer.getTotalSize() }} className="relative w-full">
          {virtualItems.map((row) => {
            const start = row.index * columns
            return (
              <div
                key={row.key}
                style={{
                  transform: `translateY(${row.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
                  gap: GAP,
                  padding: GAP / 2,
                }}
                className="absolute top-0 left-0 box-border grid w-full"
              >
                {items.slice(start, start + columns).map((item, j) => (
                  <div key={item.key} style={{ width: cellSize, height: cardH }}>
                    {renderCell(item, start + j)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { CardGridProps }
export { CardGrid }
