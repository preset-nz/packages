import * as React from "react"

import { cn } from "../lib/utils"

// List and ListRow: a set of things (models, files, recent items) built from
// slots. Without `selection` it is a plain `role="list"` and the rows'
// `trailing` actions are the only interactive parts (Tab walks them). With
// `selection` it is a `role="listbox"` with roving tabindex: Up, Down, Home
// and End move focus, Enter or Space selects. Rows must be direct children of
// the List (the List reads their ids). A selectable list takes no `trailing`
// controls: a button inside an option is invalid ARIA, and its click would
// select the row too. No virtualisation, reorder or sections.
//
// `className` and other props go on the List's outer element; the accessible
// name (`aria-label`, `aria-labelledby`) goes on the element with the role.

interface ListSelection {
  selectedId: string | null
  onSelect: (id: string) => void
}

interface ListContextValue {
  selection: ListSelection | undefined
  tabStopId: string | undefined
  setFocusId: (id: string) => void
}

const ListContext = React.createContext<ListContextValue>({
  selection: undefined,
  tabStopId: undefined,
  setFocusId: () => {},
})

interface ListProps extends Omit<React.ComponentProps<"div">, "role" | "children"> {
  /** Makes the list a selectable listbox. Leave undefined for a plain list. */
  selection?: ListSelection
  /** Shown in place of the rows when there are no children. Usually an EmptyState. */
  empty?: React.ReactNode
  /** After the rows. */
  footer?: React.ReactNode
  children?: React.ReactNode
}

function List({
  selection,
  empty,
  footer,
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ListProps) {
  const rows = React.Children.toArray(children)
  const ids = rows.flatMap((row) =>
    React.isValidElement<{ id?: string }>(row) && typeof row.props.id === "string"
      ? [row.props.id]
      : [],
  )
  const [focusId, setFocusId] = React.useState<string | undefined>(undefined)
  const rowsRef = React.useRef<HTMLDivElement>(null)

  // The one tab stop: the last focused row, else the selected one, else the first.
  const tabStopId =
    [focusId, selection?.selectedId ?? undefined].find(
      (id): id is string => id !== undefined && ids.includes(id),
    ) ?? ids[0]

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (!selection || event.defaultPrevented) return
    const options = Array.from(
      rowsRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    )
    const current = options.indexOf(event.target as HTMLElement)
    if (current === -1) return
    let next: number
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(current + 1, options.length - 1)
        break
      case "ArrowUp":
        next = Math.max(current - 1, 0)
        break
      case "Home":
        next = 0
        break
      case "End":
        next = options.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    options[next]?.focus()
  }

  const context = React.useMemo<ListContextValue>(
    () => ({ selection, tabStopId, setFocusId }),
    [selection, tabStopId],
  )

  return (
    <div data-slot="list" className={cn("flex flex-col", className)} {...props}>
      {rows.length === 0 ? (
        empty
      ) : (
        <ListContext.Provider value={context}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys on the listbox are the roving-tabindex pattern, the options hold the focus */}
          {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is always list or listbox, and both take a name; Biome can't read the ternary */}
          <div
            ref={rowsRef}
            role={selection ? "listbox" : "list"}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            data-slot="list-rows"
            className="flex flex-col divide-y divide-border"
            onKeyDown={handleKeyDown}
          >
            {rows}
          </div>
        </ListContext.Provider>
      )}
      {footer && rows.length > 0 ? (
        <div
          data-slot="list-footer"
          className="border-t border-border px-3 py-2 text-sm text-muted-foreground"
        >
          {footer}
        </div>
      ) : null}
    </div>
  )
}

interface ListRowProps
  extends Omit<
    React.ComponentProps<"div">,
    "id" | "title" | "role" | "children" | "onClick" | "onSelect"
  > {
  /** Identifies the row to `selection`. Not set as the DOM id. */
  id: string
  /** Before the text: an icon or thumbnail. */
  leading?: React.ReactNode
  title: React.ReactNode
  /** One muted line under the title. */
  detail?: React.ReactNode
  /** After the text: a Button, a Badge. Clickable things go here, not on the row, and only in a plain list. */
  trailing?: React.ReactNode
}

function ListRow({ id, leading, title, detail, trailing, className, ...props }: ListRowProps) {
  const { selection, tabStopId, setFocusId } = React.useContext(ListContext)
  const selectable = selection !== undefined
  const selected = selectable && selection.selectedId === id

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    props.onKeyDown?.(event)
    // Keys from a trailing control stay with that control.
    if (!selectable || event.defaultPrevented || event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      selection.onSelect(id)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the role is option when selectable; a plain row has no handlers that act
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-selected is set only when the role is option
    <div
      data-slot="list-row"
      data-row-id={id}
      data-selected={selected ? "" : undefined}
      role={selectable ? "option" : "listitem"}
      aria-selected={selectable ? selected : undefined}
      tabIndex={selectable ? (tabStopId === id ? 0 : -1) : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 py-1.5 outline-none",
        selectable &&
          "cursor-default hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 data-selected:bg-accent",
        className,
      )}
      {...props}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        props.onFocus?.(event)
        if (selectable && event.target === event.currentTarget) setFocusId(id)
      }}
      onClick={selectable ? () => selection.onSelect(id) : undefined}
    >
      {leading ? (
        <div className="shrink-0 text-muted-foreground [&_svg]:size-5">{leading}</div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

export type { ListProps, ListRowProps, ListSelection }
export { List, ListRow }
