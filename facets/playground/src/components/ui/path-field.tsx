import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// The facets playground's own PathField: the host contract of ux-kit's, without its icons and
// popover. A text field that commits on Return or blur and reverts on Esc, a "Missing" tag, an
// invalid message, a ▾ list of recent paths (a plain list here) and a browse button. A refused
// commit (status "invalid") keeps the typed draft; a new `value` drops it.
interface PathFieldProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  value: string | null
  onCommit?: (path: string | null) => void
  recent?: string[]
  onBrowse?: () => Promise<string | null>
  status?: "ok" | "missing" | "invalid"
  message?: string
  label?: string
  placeholder?: string
  disabled?: boolean
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
  ...props
}: PathFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const sent = React.useRef<string | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new value is the host accepting (or replacing) the text
  React.useEffect(() => {
    setDraft(null)
    sent.current = null
  }, [value])

  const commit = () => {
    if (draft === null) return
    const text = draft.trim()
    if (text === (value ?? "")) return setDraft(null)
    if (text === sent.current) return
    sent.current = text
    onCommit?.(text === "" ? null : text)
  }
  const choose = (path: string) => {
    setDraft(null)
    setOpen(false)
    onCommit?.(path)
  }

  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          aria-label={label}
          value={draft ?? value ?? ""}
          placeholder={placeholder}
          readOnly={!onCommit}
          disabled={disabled}
          aria-invalid={status === "invalid" || undefined}
          onChange={(e) => {
            sent.current = null
            setDraft(e.target.value)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape" && draft !== null) {
              sent.current = null
              setDraft(null)
            }
          }}
        />
        {status === "missing" && draft === null && value ? (
          <span className="text-[11px] text-destructive">Missing</span>
        ) : null}
        <button
          type="button"
          aria-label="Recent"
          disabled={disabled || !onCommit || !recent?.length}
          onClick={() => setOpen((o) => !o)}
        >
          ▾
        </button>
        {onBrowse ? (
          <button
            type="button"
            aria-label="Choose File…"
            disabled={disabled || !onCommit}
            onClick={async () => {
              const picked = await onBrowse()
              if (picked != null) choose(picked)
            }}
          >
            +
          </button>
        ) : null}
      </div>
      {open && recent?.length ? (
        <ul aria-label="Recent files" className="text-xs">
          {recent.map((path) => (
            <li key={path}>
              <button type="button" onClick={() => choose(path)}>
                {path}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status === "invalid" && message ? (
        <p className="text-xs text-destructive">{message}</p>
      ) : null}
    </div>
  )
}

export type { PathFieldProps }
export { PathField }
