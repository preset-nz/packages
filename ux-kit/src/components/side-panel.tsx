import type * as React from "react"

import { cn } from "../lib/utils"
import { buttonVariants } from "./button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

// SidePanel: a docked panel with a collapsed icon rail and a drag-to-resize
// edge (ux-patterns.md, "Side panels"). Props only: the app owns `open` and
// `width`, so it can persist them and toggle from the menu, the toolbar or a
// shortcut. Collapsed, the panel leaves a narrow rail with one icon that
// reopens it. The drag uses pointer capture, so the edge never drifts from
// the cursor; arrow keys on the focused edge resize too.

/** Keeps a width inside [min, max], in whole pixels; a corrupt stored value falls back to `min`. */
function clampWidth(width: number, min: number, max: number): number {
  if (!Number.isFinite(width)) return min
  return Math.min(max, Math.max(min, Math.round(width)))
}

/** Width of a collapsed panel's spine (`spine` prop). */
const SPINE_WIDTH = 28

interface SidePanelProps extends Omit<React.ComponentProps<"aside">, "title"> {
  /** Which window edge the panel docks to. The resize handle sits on the inner edge. */
  side: "left" | "right"
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Width in px while open. */
  width: number
  onWidthChange: (width: number) => void
  minWidth?: number
  maxWidth?: number
  /** Names the panel in the rail tooltip and for assistive tech. */
  title: string
  /** The rail's icon. */
  icon: React.ReactNode
  /** Shown in the rail tooltip, in platform notation ("⌥⌘S"). */
  shortcut?: string
  /**
   * Collapsed, leave a full-height spine that reads `title` sideways, and
   * reopens on a click anywhere on it, instead of the icon rail. `icon` is not
   * drawn then. For a library's filter and properties panels, which have no
   * natural icon.
   */
  spine?: boolean
  /** Double-clicking the resize edge restores this width. No reset without it. */
  defaultWidth?: number
}

function SidePanel({
  side,
  open,
  onOpenChange,
  width,
  onWidthChange,
  minWidth = 180,
  maxWidth = 480,
  title,
  icon,
  shortcut,
  spine = false,
  defaultWidth,
  className,
  children,
  ...props
}: SidePanelProps) {
  const border = side === "left" ? "border-r" : "border-l"

  if (!open && spine) {
    return (
      <aside
        data-slot="side-panel"
        data-state="closed"
        aria-label={title}
        className={cn(
          "flex shrink-0 text-sidebar-foreground",
          border,
          "border-sidebar-border",
          className,
        )}
        style={{ width: SPINE_WIDTH }}
        {...props}
      >
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={`Show ${title}`}
          title={shortcut ? `Show ${title}  ${shortcut}` : `Show ${title}`}
          className="flex h-full w-full cursor-pointer items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <span className="rotate-180 font-semibold text-[10px] uppercase tracking-wider [writing-mode:vertical-rl]">
            {title}
          </span>
        </button>
      </aside>
    )
  }

  if (!open) {
    return (
      <aside
        data-slot="side-panel"
        data-state="closed"
        aria-label={title}
        className={cn(
          "flex w-10 shrink-0 flex-col items-center bg-sidebar py-2 text-sidebar-foreground",
          border,
          "border-sidebar-border",
          className,
        )}
        {...props}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`Show ${title}`}
                onClick={() => onOpenChange(true)}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              />
            }
          >
            {icon}
          </TooltipTrigger>
          <TooltipContent side={side === "left" ? "right" : "left"}>
            <span>Show {title}</span>
            {shortcut ? (
              <kbd
                data-slot="kbd"
                className="rounded-sm bg-background/20 px-1 font-sans text-[11px]"
              >
                {shortcut}
              </kbd>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </aside>
    )
  }

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startWidth = width
    const sign = side === "left" ? 1 : -1
    const move = (ev: PointerEvent) =>
      onWidthChange(clampWidth(startWidth + sign * (ev.clientX - startX), minWidth, maxWidth))
    const end = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", end)
      el.removeEventListener("pointercancel", end)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", end)
    el.addEventListener("pointercancel", end)
  }

  const onKey = (e: React.KeyboardEvent) => {
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft"
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight"
    if (e.key !== grow && e.key !== shrink) return
    e.preventDefault()
    onWidthChange(clampWidth(width + (e.key === grow ? 16 : -16), minWidth, maxWidth))
  }

  const w = clampWidth(width, minWidth, maxWidth)
  return (
    <aside
      data-slot="side-panel"
      data-state="open"
      aria-label={title}
      style={{ width: w }}
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        border,
        "border-sidebar-border",
        className,
      )}
      {...props}
    >
      {children}
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable, keyboard-operable splitter (WAI-ARIA window splitter); <hr> is not focusable */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title}`}
        aria-valuenow={w}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onKey}
        onDoubleClick={
          defaultWidth === undefined
            ? undefined
            : () => onWidthChange(clampWidth(defaultWidth, minWidth, maxWidth))
        }
        className={cn(
          "absolute inset-y-0 z-10 w-1 cursor-col-resize touch-none hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none",
          side === "left" ? "right-0" : "left-0",
        )}
      />
    </aside>
  )
}

/** A panel's title row; put the panel's own actions in `children`. */
function SidePanelHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-header"
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 border-b border-sidebar-border px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** The scrolling body under the header. */
function SidePanelContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-content"
      className={cn("min-h-0 flex-1 overflow-auto", className)}
      {...props}
    />
  )
}

export type { SidePanelProps }
export { clampWidth, SidePanel, SidePanelContent, SidePanelHeader, SPINE_WIDTH }
