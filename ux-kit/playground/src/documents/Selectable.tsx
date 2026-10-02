import type { ReactNode } from "react"
import { cn } from "@preset.nz/ux-kit"

/**
 * One selectable item in a document's centre view. A click or focus inside selects it;
 * clicks that land outside every `[data-selectable]` are the canvas's, which clears. The
 * selected look is the same everywhere.
 */
export function Selectable({
  selected,
  onSelect,
  className,
  children,
  as: Tag = "div",
}: {
  selected: boolean
  onSelect: () => void
  className?: string
  children: ReactNode
  as?: "div" | "article" | "section"
}) {
  return (
    <Tag
      tabIndex={0}
      aria-current={selected || undefined}
      data-selected={selected || undefined}
      data-selectable=""
      onClick={onSelect}
      // Focus inside a child control selects too; an item that already holds the selection is left be.
      onFocus={() => !selected && onSelect()}
      className={cn(
        "rounded-md outline-none transition-shadow",
        "data-selected:ring-2 data-selected:ring-selection data-selected:ring-offset-2 data-selected:ring-offset-background",
        className,
      )}
    >
      {children}
    </Tag>
  )
}
