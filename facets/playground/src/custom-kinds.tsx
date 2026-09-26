import {
  registerFieldRenderer,
  type CustomFieldDef,
  type FieldRenderer,
} from "../../src"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Custom kinds are matched by string. The type system can't see their extra
// props, so each renderer documents what it reads.

/** Reads `colours: string[]`. The value is the chosen hex string. */
const Swatches: FieldRenderer<CustomFieldDef> = ({ field, value, disabled, onChange }) => {
  const colours = Array.isArray(field.colours) ? (field.colours as string[]) : []
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
            disabled={disabled || !onChange}
            onClick={() => onChange?.(c)}
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
            disabled={disabled || !onChange}
            onClick={() => onChange?.(i + 1 === current ? 0 : i + 1)}
            className={i < current ? "text-foreground" : "text-muted-foreground/40"}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

export function registerCustomKinds(): void {
  registerFieldRenderer("swatches", Swatches as FieldRenderer)
  registerFieldRenderer("rating", Rating as FieldRenderer)
}
