import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar"
import * as React from "react"

import { cn } from "../lib/utils"
import { buttonVariants } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

// Toolbar: props and callbacks only, no app state. The rules (native-apps.md,
// ux-patterns.md): icon only, tooltip with name and shortcut, groups split by
// separators, toggles show a pressed state, and every item is a command that
// also lives in the menu. The toolbar is a subset of the menu, not a second
// home for commands.
//
// Two ways in. Data-driven: `<Toolbar groups={[[item, item], [item]]} onCommand={run} />`
// where `id` is the menu's command id. Composed: `ToolbarGroup`, `ToolbarSeparator`,
// `ToolbarSpacer` and `ToolbarButton` as children, for anything the table cannot say.
//
// Roving focus and arrow-key navigation come from Base UI's Toolbar. Disabled
// buttons stay focusable and keep their tooltip, which is how a gated item
// says why it is gated (Oblique's `disabledHint`, M&T's `disabledReason`).

/** An entry in a dropdown item's menu. */
interface ToolbarMenuEntry {
  id: string
  label: string
  shortcut?: string
  /** Default true. */
  enabled?: boolean
}

/** One toolbar item. `id` is the command id shared with the menu. */
interface ToolbarItemSpec {
  id: string
  label: string
  icon: React.ReactNode
  /** Shown in the tooltip, in the platform's own notation ("⌘S"). */
  shortcut?: string
  /** Default true. */
  enabled?: boolean
  /** Replaces the shortcut in the tooltip while the item is disabled. */
  disabledReason?: string
  /** Present (true or false) makes the item a toggle. Absent means a plain button. */
  pressed?: boolean
  /** Present makes the item a dropdown; picking an entry calls `onCommand(entry.id)`. */
  menu?: ToolbarMenuEntry[]
}

function Toolbar({ className, ...props }: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={cn(
        "flex items-center gap-1 border-b border-border bg-background px-2 py-1 data-[orientation=vertical]:w-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:border-r data-[orientation=vertical]:border-b-0",
        className,
      )}
      {...props}
    />
  )
}

function ToolbarGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Group>) {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={cn("flex items-center gap-0.5 data-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  )
}

function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={cn(
        "mx-1 h-5 w-px shrink-0 bg-border data-[orientation=horizontal]:mx-0 data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-5",
        className,
      )}
      {...props}
    />
  )
}

/** Pushes what follows to the far end (the right-panel toggle sits there). */
function ToolbarSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="toolbar-spacer" className={cn("flex-1", className)} {...props} />
}

function TooltipBody({
  label,
  shortcut,
  disabledReason,
}: Pick<ToolbarItemSpec, "label" | "shortcut" | "disabledReason">) {
  return (
    <>
      <span>{label}</span>
      {disabledReason ? (
        <span className="opacity-70">{disabledReason}</span>
      ) : shortcut ? (
        <kbd data-slot="kbd" className="rounded-sm bg-background/20 px-1 font-sans text-[11px]">
          {shortcut}
        </kbd>
      ) : null}
    </>
  )
}

const buttonClass = (pressed?: boolean) =>
  cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "data-disabled:cursor-default data-disabled:opacity-40 data-disabled:hover:bg-transparent",
    pressed && "bg-muted text-foreground",
  )

interface ToolbarButtonProps
  extends Omit<ToolbarItemSpec, "id" | "menu">,
    Omit<React.ComponentProps<typeof ToolbarPrimitive.Button>, "children" | "aria-label"> {}

/** One icon button: plain, or a toggle when `pressed` is given. Tooltip shows label and shortcut. */
function ToolbarButton({
  label,
  icon,
  shortcut,
  enabled = true,
  disabledReason,
  pressed,
  className,
  ...props
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarPrimitive.Button
            data-slot="toolbar-button"
            aria-label={label}
            aria-pressed={pressed}
            disabled={!enabled}
            className={cn(buttonClass(pressed), className)}
            {...props}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipBody
          label={label}
          shortcut={shortcut}
          disabledReason={enabled ? undefined : disabledReason}
        />
      </TooltipContent>
    </Tooltip>
  )
}

interface ToolbarDropdownProps extends Omit<ToolbarItemSpec, "id" | "menu" | "pressed"> {
  entries: ToolbarMenuEntry[]
  onCommand?: (id: string) => void
}

/** An icon button that opens a menu of commands. Entries are menu items, so they show shortcuts too. */
function ToolbarDropdown({
  label,
  icon,
  shortcut,
  enabled = true,
  disabledReason,
  entries,
  onCommand,
}: ToolbarDropdownProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <ToolbarPrimitive.Button
                  data-slot="toolbar-dropdown"
                  aria-label={label}
                  disabled={!enabled}
                  className={buttonClass()}
                />
              }
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TooltipBody
            label={label}
            shortcut={shortcut}
            disabledReason={enabled ? undefined : disabledReason}
          />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        {entries.map((e) => (
          <DropdownMenuItem
            key={e.id}
            disabled={e.enabled === false}
            onClick={() => onCommand?.(e.id)}
          >
            {e.label}
            {e.shortcut ? <DropdownMenuShortcut>{e.shortcut}</DropdownMenuShortcut> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Renders one spec as a button, toggle or dropdown. */
function ToolbarItem({
  item,
  onCommand,
}: {
  item: ToolbarItemSpec
  onCommand?: (id: string) => void
}) {
  if (item.menu) {
    return <ToolbarDropdown {...item} entries={item.menu} onCommand={onCommand} />
  }
  return <ToolbarButton {...item} onClick={() => onCommand?.(item.id)} />
}

interface ToolbarItemsProps extends Omit<React.ComponentProps<typeof Toolbar>, "children"> {
  /** Groups of items; a separator is drawn between groups. */
  groups: ToolbarItemSpec[][]
  /** Called with the item's (or menu entry's) id. The app runs the same command the menu does. */
  onCommand?: (id: string) => void
  /** Pinned to the far left, before the groups (the left-panel toggle). */
  leading?: ToolbarItemSpec[]
  /** Pinned to the far right (the right-panel toggle). */
  trailing?: ToolbarItemSpec[]
  /** Extra content between the groups and the trailing items: a slot for anything custom. */
  children?: React.ReactNode
}

/** The data-driven form: a toolbar from an item table. */
function ToolbarItems({
  groups,
  onCommand,
  leading,
  trailing,
  children,
  ...props
}: ToolbarItemsProps) {
  const lead = leading?.length ? [leading] : []
  const all = [...lead, ...groups.filter((g) => g.length > 0)]
  return (
    <Toolbar {...props}>
      {all.map((group, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: groups are anonymous lists rebuilt each render and never reordered
        <React.Fragment key={i}>
          {i > 0 && <ToolbarSeparator />}
          <ToolbarGroup>
            {group.map((item) => (
              <ToolbarItem key={item.id} item={item} onCommand={onCommand} />
            ))}
          </ToolbarGroup>
        </React.Fragment>
      ))}
      {children}
      {trailing?.length ? (
        <>
          <ToolbarSpacer />
          <ToolbarGroup>
            {trailing.map((item) => (
              <ToolbarItem key={item.id} item={item} onCommand={onCommand} />
            ))}
          </ToolbarGroup>
        </>
      ) : null}
    </Toolbar>
  )
}

export type { ToolbarItemSpec, ToolbarMenuEntry }
export {
  Toolbar,
  ToolbarButton,
  ToolbarDropdown,
  ToolbarGroup,
  ToolbarItem,
  ToolbarItems,
  ToolbarSeparator,
  ToolbarSpacer,
}
