import {
  registerFieldRenderer,
  type CustomFieldDef,
  type FieldRenderer,
} from "../../src"
import type React from "react"
import { ColorPicker } from "@/components/ui/color-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Custom kinds are matched by string. The type system can't see their extra
// props, so each renderer documents what it reads.

/** Reads `colours: string[]`. The value is the chosen hex string. */
const Swatches: FieldRenderer<CustomFieldDef> = ({ field, value, disabled, onChange }) => {
  const colours = Array.isArray(field.colours) ? (field.colours as string[]) : []
  // Read-only is formatted information, not a disabled control. Disabled is
  // for disabledWhen only.
  if (!onChange) {
    const hex = typeof value === "string" ? value : null
    return (
      <FieldLabel label={field.label ?? field.id}>
        <div className="flex min-h-8 items-center gap-2 py-1 text-xs">
          {hex && <span className="size-4 border border-border" style={{ backgroundColor: hex }} />}
          <span className="font-mono">{hex ?? "—"}</span>
        </div>
      </FieldLabel>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {field.label ?? field.id}
      </Label>
      <div className="flex gap-1">
        {colours.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={cn(
              "size-6 border border-border disabled:cursor-default",
              disabled && "opacity-50",
              value === c && "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}

/** Reads `max?: number` (default 5). The value is a whole number. */
const Rating: FieldRenderer<CustomFieldDef> = ({ field, value, disabled, onChange }) => {
  const max = typeof field.max === "number" ? field.max : 5
  const current = typeof value === "number" ? value : 0
  if (!onChange) {
    return (
      <FieldLabel label={field.label ?? field.id}>
        <div className="min-h-8 py-1 text-xs tabular-nums">
          {current} / {max}
        </div>
      </FieldLabel>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {field.label ?? field.id}
      </Label>
      <div className={cn("flex gap-0.5 text-base leading-none", disabled && "opacity-50")}>
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1} of ${max}`}
            disabled={disabled}
            onClick={() => onChange(i + 1 === current ? 0 : i + 1)}
            className={i < current ? "text-foreground" : "text-muted-foreground/40"}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Overrides the built-in `color` kind, which is a swatch and a hex box. The
 * package stays picker-agnostic; a host that wants a picker registers its own
 * renderer after `registerBuiltinRenderers()`, and the last registration wins.
 */
const PickerColor: FieldRenderer<CustomFieldDef> = ({ field, value, disabled, onChange }) => {
  const hex = typeof value === "string" && value.length > 0 ? value : null
  const label = field.label ?? field.id
  return (
    <FieldLabel label={label}>
      <div className="flex items-center gap-2">
        {onChange ? (
          <>
            <ColorPicker color={hex ?? "#000000"} onChange={onChange} disabled={disabled} />
            <Input
              aria-label={label}
              value={hex ?? ""}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className="font-mono"
            />
          </>
        ) : (
          <div className="flex min-h-8 items-center gap-2 py-1 text-xs">
            {hex && <span className="size-4 border border-border" style={{ backgroundColor: hex }} />}
            <span className="font-mono">{hex ?? "—"}</span>
          </div>
        )}
      </div>
    </FieldLabel>
  )
}

export function registerCustomKinds(): void {
  registerFieldRenderer("color", PickerColor as FieldRenderer)
  registerFieldRenderer("swatches", Swatches as FieldRenderer)
  registerFieldRenderer("rating", Rating as FieldRenderer)
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
