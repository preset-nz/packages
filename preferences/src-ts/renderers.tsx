/* eslint-disable react-refresh/only-export-components --
 * Two small renderers for the kinds facets has no built-in for, plus their
 * registration. Same shape as facets' own field-renderers module. */
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerFieldRenderer, type FieldRenderer } from "@preset.nz/facets"

function Shell({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <Label className="text-[11px] font-medium tracking-wide text-muted-foreground">
          {label}
        </Label>
      )}
      {children}
    </div>
  )
}

/** A list of short strings, edited as a comma-separated line, committed on blur or Enter. */
const StringListRenderer: FieldRenderer = ({ field, value, disabled, onChange }) => {
  const items = Array.isArray(value) ? (value as string[]) : []
  const joined = items.join(", ")
  const [draft, setDraft] = useState(joined)
  useEffect(() => setDraft(joined), [joined])
  const commit = () => {
    const next = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (next.join(",") !== items.join(",")) onChange?.(next)
  }
  return (
    <Shell label={field.label}>
      <Input
        value={draft}
        disabled={disabled || !onChange}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit()
            e.currentTarget.blur()
          }
        }}
        className="h-8 text-xs"
      />
    </Shell>
  )
}

/** A path shown, selectable, never edited. */
const ReadonlyPathRenderer: FieldRenderer = ({ field, value }) => (
  <Shell label={field.label}>
    <div className="select-text break-all py-1 font-mono text-[11px] text-foreground">
      {typeof value === "string" && value ? value : "—"}
    </div>
  </Shell>
)

let registered = false

/** Idempotent; the window calls it on mount. */
export function registerPreferenceRenderers(): void {
  if (registered) return
  registered = true
  registerFieldRenderer("string-list", StringListRenderer)
  registerFieldRenderer("readonly-path", ReadonlyPathRenderer)
}
