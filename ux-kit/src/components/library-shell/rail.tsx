import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon } from "@phosphor-icons/react"
import type * as React from "react"

import { cn } from "../../lib/utils"

// The rail: the stack of collapsible sections inside a library's left panel
// (ux-patterns.md, "Side panels"). The kit draws the frame, the section header
// and the row look. What goes in each section, and whether it is collapsed,
// is the app's: sections are controlled, so the app persists them.

/** The scrolling column that holds the sections. Put it inside a `SidePanel`. */
function Rail({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="rail"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-xs", className)}
      {...props}
    />
  )
}

interface RailSectionProps {
  /** Names the body for assistive tech; unique within the rail. */
  id: string
  title: string
  collapsed: boolean
  onToggle: () => void
  /** Shown beside the title while collapsed, so a closed section still says what is set. */
  summary?: React.ReactNode
  children: React.ReactNode
}

function RailSection({ id, title, collapsed, onToggle, summary, children }: RailSectionProps) {
  const bodyId = `rail-section-${id}-body`
  return (
    <section data-slot="rail-section" className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
        className="-mx-1 flex items-center gap-1 rounded-sm px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <CaretRightIcon
          weight="bold"
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            !collapsed && "rotate-90",
          )}
        />
        <h2 className="flex-1 truncate font-heading text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h2>
        {collapsed && summary !== undefined && summary !== null && (
          <span className="text-[10px] text-muted-foreground/80">· {summary}</span>
        )}
      </button>
      {!collapsed && (
        <div id={bodyId} className="flex flex-col gap-1">
          {children}
        </div>
      )}
    </section>
  )
}

interface RailRowProps extends Omit<React.ComponentProps<"button">, "children" | "onClick"> {
  /** Drawn before the label: a swatch, an icon, a glyph. */
  leading?: React.ReactNode
  label: React.ReactNode
  /** Shown tabular at the right; formatted with the locale. */
  count?: number
  selected?: boolean
  /** Dimmed and read-only, and keeps its selection. */
  readOnly?: boolean
  /**
   * A row with nothing to pick (count 0, not selected) is greyed and disabled.
   * Off for rows that are always pickable, like Library.
   */
  dimWhenEmpty?: boolean
  /** `nav` is the larger row that switches the whole view (Library, Trash). */
  variant?: "item" | "nav"
  onClick: () => void
}

function RailRow({
  leading,
  label,
  count,
  selected = false,
  readOnly = false,
  dimWhenEmpty = true,
  variant = "item",
  disabled,
  onClick,
  className,
  ...props
}: RailRowProps) {
  const empty = dimWhenEmpty && variant === "item" && count === 0 && !selected
  const nav = variant === "nav"
  return (
    <button
      type="button"
      data-slot="rail-row"
      aria-pressed={selected}
      disabled={disabled || empty || readOnly}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        nav ? "-mx-1 w-[calc(100%+0.5rem)] px-2 py-1" : "w-full px-1 py-0.5",
        selected
          ? "bg-muted text-foreground"
          : empty
            ? "text-muted-foreground/40"
            : "text-foreground hover:bg-muted/60",
        readOnly && "cursor-default opacity-60 hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {leading}
      <span className={cn("flex-1 truncate", nav && "font-medium")}>{label}</span>
      {count !== undefined && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {count.toLocaleString()}
        </span>
      )}
    </button>
  )
}

interface RailSortProps<K extends string> {
  value: K
  onValueChange: (next: K) => void
  options: readonly { key: K; label: string }[]
  direction: "asc" | "desc"
  onDirectionToggle: () => void
}

/** A sort key select and its direction toggle: the body of a rail's Sort section. */
function RailSort<K extends string>({
  value,
  onValueChange,
  options,
  direction,
  onDirectionToggle,
}: RailSortProps<K>) {
  const asc = direction === "asc"
  const Arrow = asc ? ArrowUpIcon : ArrowDownIcon
  return (
    <div data-slot="rail-sort" className="flex gap-1">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value as K)}
        disabled={options.length <= 1}
        aria-label="Sort by"
        className="h-7 flex-1 rounded-sm border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default disabled:opacity-80"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDirectionToggle}
        aria-label={asc ? "Sort ascending, click to descend" : "Sort descending, click to ascend"}
        title={asc ? "Ascending" : "Descending"}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Arrow weight="bold" className="size-3.5" />
      </button>
    </div>
  )
}

export type { RailRowProps, RailSectionProps, RailSortProps }
export { Rail, RailRow, RailSection, RailSort }
