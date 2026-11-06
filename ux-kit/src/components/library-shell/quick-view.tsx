import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react"
import { useEffect } from "react"

import { cn } from "../../lib/utils"

// A near-fullscreen preview over the library, like Finder's Quick Look. The
// kit owns the frame, the counter, the arrows and the keys (Esc and Space
// close, Left and Right step). What the picture is, and any tools over it, come
// from the app.

interface QuickViewProps<T extends { key: string }> {
  items: readonly T[]
  index: number
  onClose: () => void
  onIndexChange: (next: number) => void
  /** The header's title line for the shown item, usually its file name. */
  title: (item: T) => React.ReactNode
  /** Draws the shown item, centred in the space under the header. */
  renderItem: (item: T) => React.ReactNode
  /** The app's tools, drawn in the header before the counter. */
  tools?: React.ReactNode
  /**
   * Called on open. Return the release for close. Lets the app stand its own
   * window-level shortcuts down while the preview owns the screen.
   */
  onOverlay?: () => () => void
  className?: string
}

function QuickView<T extends { key: string }>({
  items,
  index,
  onClose,
  onIndexChange,
  title,
  renderItem,
  tools,
  onOverlay,
  className,
}: QuickViewProps<T>) {
  const item = items[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault()
        onIndexChange(index - 1)
      } else if (e.key === "ArrowRight" && index < items.length - 1) {
        e.preventDefault()
        onIndexChange(index + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, items.length, onClose, onIndexChange])

  useEffect(() => onOverlay?.(), [onOverlay])

  if (!item) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-slot="quick-view"
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <span className="truncate text-xs text-muted-foreground select-text">{title(item)}</span>
        <div className="ml-auto flex items-center gap-1">{tools}</div>
        <span className="font-heading text-[10px] tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          aria-label="Close quick view"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <XIcon weight="bold" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {/* Click anywhere outside the picture and the arrows to close. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Click outside the picture to close"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />
        {renderItem(item)}
        {index > 0 && <NavButton side="left" onClick={() => onIndexChange(index - 1)} />}
        {index < items.length - 1 && (
          <NavButton side="right" onClick={() => onIndexChange(index + 1)} />
        )}
      </div>
    </div>
  )
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-sm bg-card/60 text-muted-foreground backdrop-blur-sm hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      {side === "left" ? <CaretLeftIcon weight="bold" /> : <CaretRightIcon weight="bold" />}
    </button>
  )
}

export type { QuickViewProps }
export { QuickView }
