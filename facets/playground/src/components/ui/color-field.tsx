import { cn } from "@/lib/utils"

// The facets playground's own ColorField: the host contract with a swatch, hex text and the
// native picker. onPickStart/End are the picker's focus and blur.
interface ColorFieldProps {
  value: string | null
  onChange?: (value: string | null) => void
  label?: string
  presets?: string[]
  readOnly?: boolean
  disabled?: boolean
  onPickStart?: () => void
  onPickEnd?: () => void
  className?: string
}

function ColorField({ value, onChange, label, presets, readOnly, disabled, onPickStart, onPickEnd, className }: ColorFieldProps) {
  const locked = readOnly || !onChange
  const picker = /^#[0-9a-f]{6}/i.test(value ?? "") ? value!.slice(0, 7) : "#000000"
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label ? `${label} picker` : "Colour picker"}
          value={picker}
          disabled={disabled || locked}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onPickStart}
          onBlur={onPickEnd}
          className="size-7 shrink-0 border border-border bg-transparent p-0"
        />
        <input
          aria-label={label ? `${label} hex` : "Hex"}
          value={value ?? ""}
          readOnly={locked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-8 min-w-0 flex-1 border border-input bg-transparent px-2 font-mono text-xs"
        />
        {presets?.map((c) => (
          <button key={c} type="button" aria-label={c} disabled={disabled || locked} onClick={() => onChange?.(c)} className="size-4 border border-border" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  )
}

export { ColorField }
