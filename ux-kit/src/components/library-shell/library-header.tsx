import { ArrowLeftIcon, MagnifyingGlassIcon, SidebarSimpleIcon } from "@phosphor-icons/react"
import type * as React from "react"

import { cn } from "../../lib/utils"
import { Button } from "../button"
import { Input } from "../input"

// The library's header strip: a panel toggle at each end (ux-patterns.md,
// "Side panels"), the app's title and a summary of what is shown, a search
// field and the app's own actions. Titles and strings come in as props, so the
// product name stays in the app's branding.

interface PanelToggle {
  /** True while the panel is collapsed. */
  collapsed: boolean
  onToggle: () => void
  /** Greys the toggle out, for a panel that is not drawn. */
  disabled?: boolean
  /** Names the panel in the toggle's label: "filters panel" gives "Hide filters panel". */
  label: string
  /** The key shown in the tooltip, in platform notation ("["). */
  shortcut?: string
}

interface LibrarySearch {
  value: string
  onChange: (next: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  placeholder?: string
  /** Names the field for assistive tech. */
  label: string
  /** Shown in the tooltip, in platform notation ("⌘F"). */
  shortcut?: string
}

interface LibraryHeaderProps {
  /** The product name, from the app's branding. */
  title: string
  /** Counts and filter state, drawn beside the title. */
  summary?: React.ReactNode
  left: PanelToggle
  right: PanelToggle
  search?: LibrarySearch
  /** Shows a back button before the title when set. */
  onBack?: () => void
  backLabel?: string
  /** The app's actions, drawn between the search field and the right toggle. */
  children?: React.ReactNode
  className?: string
}

function toggleTitle(t: PanelToggle) {
  const base = `${t.collapsed ? "Show" : "Hide"} ${t.label}`
  return t.shortcut ? `${base}  ${t.shortcut}` : base
}

function LibraryHeader({
  title,
  summary,
  left,
  right,
  search,
  onBack,
  backLabel = "Library",
  children,
  className,
}: LibraryHeaderProps) {
  return (
    <header
      data-slot="library-header"
      className={cn("flex h-10 shrink-0 items-center gap-3 border-b border-border px-3", className)}
    >
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={left.onToggle}
        disabled={left.disabled}
        aria-pressed={!left.collapsed}
        aria-label={`${left.collapsed ? "Show" : "Hide"} ${left.label}`}
        title={toggleTitle(left)}
      >
        <SidebarSimpleIcon weight="bold" />
      </Button>
      {onBack && (
        <Button size="sm" variant="ghost" onClick={onBack} aria-label={`Back to ${backLabel}`}>
          <ArrowLeftIcon weight="bold" />
          {backLabel}
        </Button>
      )}
      <h1 className="font-heading text-base font-semibold tracking-[0.04em] uppercase">{title}</h1>
      {summary}
      <div className="ml-auto flex items-center gap-2">
        {search && (
          <div className="relative w-56">
            <MagnifyingGlassIcon
              weight="bold"
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={search.inputRef}
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation()
                  search.onChange("")
                  e.currentTarget.blur()
                }
              }}
              placeholder={search.placeholder}
              aria-label={search.label}
              title={search.shortcut ? `${search.label}  ${search.shortcut}` : search.label}
              className="pl-7"
            />
          </div>
        )}
        {children}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={right.onToggle}
          disabled={right.disabled}
          aria-pressed={!right.collapsed}
          aria-label={`${right.collapsed ? "Show" : "Hide"} ${right.label}`}
          title={toggleTitle(right)}
        >
          <SidebarSimpleIcon weight="bold" className="scale-x-[-1]" />
        </Button>
      </div>
    </header>
  )
}

export type { LibraryHeaderProps, LibrarySearch, PanelToggle }
export { LibraryHeader }
