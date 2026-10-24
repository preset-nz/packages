import { CaretDownIcon, FilePlusIcon } from "@phosphor-icons/react"
import * as React from "react"

import { cn } from "../lib/utils"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Input } from "./input"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

// PathField: label, a text field for a file path, then a ▾ list of recent paths and a browse icon,
// both bare. The kit knows nothing of Tauri or the file system: the native dialog, the recent list
// and the Missing check arrive through props (app-kit supplies them). Paths are shown exactly as
// written, relative or absolute; the field never rewrites one. Text commits on Return or blur,
// never per keystroke; Esc reverts. A refused commit (status "invalid") keeps the typed draft.

/**
 * The DOM event a path field listens for on its root: a `CustomEvent` with `detail: { path }`,
 * sent by whatever turns an OS file drop into DOM (app-kit's `installPathDrop`). The kit knows
 * nothing of Tauri, only this name. app-kit/core cannot import it, so it repeats the string.
 */
const PATH_DROP_EVENT = "path-drop"
/** Set on the field's root, by the same code, while a drag is over it; the field draws a ring. */
const PATH_DROP_TARGET_ATTRIBUTE = "data-drop-target"

type PathFieldStatus = "ok" | "missing" | "invalid"

interface PathFieldProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** The path as written, relative or absolute. `null` is empty. */
  value: string | null
  /** Return or blur with changed text: the trimmed text, or null when empty. Missing makes the field read-only. */
  onCommit?: (path: string | null) => void
  /** Recent paths, newest first, for the ▾ list. Empty disables the ▾. */
  recent?: string[]
  /** Opens the native file dialog. A resolved path is committed; null (cancelled) does nothing. Missing hides the icon. */
  onBrowse?: () => Promise<string | null>
  /** "missing": the path in the warning tone with a "Missing" tag. "invalid": the field is marked and `message` shown. */
  status?: PathFieldStatus
  /** Why the path was refused; shown below the field when `status` is "invalid". */
  message?: string
  label?: string
  placeholder?: string
  disabled?: boolean
}

/** Splits a path at its last separator into the file name and the folder (with no trailing slash). */
function splitPath(path: string): { name: string; folder: string } {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  if (i < 0) return { name: path, folder: "" }
  return { name: path.slice(i + 1) || path, folder: path.slice(0, i) || path.slice(i, i + 1) }
}

/** A bare icon button with a tooltip. A disabled button gets a span trigger so the tooltip still shows. */
function IconButton({
  label,
  disabled,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label"> & { label: string }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      disabled={disabled}
      className="text-muted-foreground"
      {...props}
    >
      {children}
    </Button>
  )
  return (
    <Tooltip>
      {disabled ? (
        <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
      ) : (
        <TooltipTrigger render={button} />
      )}
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function PathField({
  value,
  onCommit,
  recent,
  onBrowse,
  status = "ok",
  message,
  label,
  placeholder,
  disabled,
  id,
  className,
  ref,
  ...props
}: PathFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const locked = !onCommit
  const inert = locked || !!disabled

  const inputRef = React.useRef<HTMLInputElement>(null)
  // The typed text while it differs from `value`. It outlives a commit the app refused ("invalid")
  // and is dropped when `value` changes, on Esc, or on a blur that changed nothing.
  const [draft, setDraft] = React.useState<string | null>(null)
  // The text last sent to onCommit, so Return then blur does not send it twice.
  const sent = React.useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new value is the app accepting (or replacing) the text
  React.useEffect(() => {
    setDraft(null)
    sent.current = null
  }, [value])

  // At rest the input shows the end of a long path (the file name), not the start.
  const showEnd = React.useCallback(() => {
    const el = inputRef.current
    if (el && document.activeElement !== el) el.scrollLeft = el.scrollWidth
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the shown text changes
  React.useLayoutEffect(showEnd, [showEnd, value, draft])

  const commit = () => {
    if (draft === null) return
    const text = draft.trim()
    if (text === (value ?? "")) {
      setDraft(null)
      return
    }
    if (text === sent.current) return
    sent.current = text
    onCommit?.(text === "" ? null : text)
  }

  const choose = (path: string) => {
    setDraft(null)
    onCommit?.(path)
  }

  // A file dropped on the field commits like a pick, unless the field is read-only or disabled.
  // The listener is on the root, which the host owns, so it reads the latest `choose` from a ref.
  const dropped = React.useRef<((path: string) => void) | null>(null)
  dropped.current = inert ? null : choose
  const rootRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      const setRef = (value: HTMLDivElement | null) => {
        if (typeof ref === "function") ref(value)
        else if (ref) ref.current = value
      }
      setRef(el)
      if (!el) return
      const onDrop = (e: Event) => {
        const path = (e as CustomEvent<{ path?: unknown }>).detail?.path
        if (typeof path === "string" && path !== "") dropped.current?.(path)
      }
      el.addEventListener(PATH_DROP_EVENT, onDrop)
      return () => {
        el.removeEventListener(PATH_DROP_EVENT, onDrop)
        setRef(null)
      }
    },
    [ref],
  )

  const browse = async () => {
    const picked = await onBrowse?.()
    if (picked != null) choose(picked)
  }

  const missing = status === "missing" && draft === null && !!value
  const invalid = status === "invalid"
  const note = invalid && message ? message : null
  const hasRecent = !!recent?.length

  return (
    <div
      ref={rootRef}
      data-slot="path-field"
      className={cn("group/path-field flex flex-col gap-1", className)}
      {...props}
    >
      <div className={cn("flex items-center gap-1", disabled && "opacity-50")}>
        {label ? (
          <label htmlFor={inputId} className="mr-1 shrink-0 text-xs text-muted-foreground">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "relative min-w-0 flex-1",
            !inert &&
              "group-data-[drop-target]/path-field:ring-2 group-data-[drop-target]/path-field:ring-ring",
          )}
        >
          <Input
            ref={inputRef}
            id={inputId}
            value={draft ?? value ?? ""}
            placeholder={placeholder}
            readOnly={locked}
            disabled={disabled}
            spellCheck={false}
            aria-invalid={invalid || undefined}
            aria-describedby={note || missing ? noteId : undefined}
            onChange={(e) => {
              sent.current = null
              setDraft(e.target.value)
            }}
            onBlur={() => {
              commit()
              showEnd()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape" && draft !== null) {
                e.stopPropagation()
                sent.current = null
                setDraft(null)
              }
            }}
            className={cn("font-mono", missing && "pr-16 text-destructive")}
          />
          {missing ? (
            <span
              id={noteId}
              className="pointer-events-none absolute inset-y-0 right-2 flex items-center bg-background pl-1 text-[11px] font-medium text-destructive dark:bg-transparent"
            >
              Missing
            </span>
          ) : null}
        </div>
        <DropdownMenu>
          <Tooltip>
            {hasRecent && !inert ? (
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Recent"
                        className="text-muted-foreground"
                      />
                    }
                  />
                }
              >
                <CaretDownIcon />
              </TooltipTrigger>
            ) : (
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Recent"
                  disabled
                  className="text-muted-foreground"
                >
                  <CaretDownIcon />
                </Button>
              </TooltipTrigger>
            )}
            <TooltipContent side="bottom">
              {hasRecent ? "Recent" : "No recent files"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="max-w-96">
            {recent?.map((path) => {
              const { name, folder } = splitPath(path)
              return (
                <DropdownMenuItem key={path} onClick={() => choose(path)} title={path}>
                  <span className="shrink-0 font-medium">{name}</span>
                  {folder ? (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">{folder}</span>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {onBrowse ? (
          <IconButton label="Choose File…" disabled={inert} onClick={browse}>
            <FilePlusIcon />
          </IconButton>
        ) : null}
      </div>
      {note ? (
        <p id={noteId} className="text-xs text-destructive">
          {note}
        </p>
      ) : null}
    </div>
  )
}

export type { PathFieldProps, PathFieldStatus }
export { PATH_DROP_EVENT, PATH_DROP_TARGET_ATTRIBUTE, PathField, splitPath }
