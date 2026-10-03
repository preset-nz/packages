import * as React from "react"

import { cn } from "../lib/utils"
import { ColorSwatch } from "./color-swatch"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

// ColorField: swatch, hex text, optional alpha, preset grid, native picker.
// Union of M&T's ColorField (presets, hex input), Oblique's colour renderers
// (native picker, read-only hex, one picker session = one undo step via
// onPickStart/onPickEnd, optional colour), and Strata's swatch popover
// (clearable, no-colour chip). Values are hex strings: #rrggbb, or #rrggbbaa
// when `alpha` is set. The palette engine (presets and derivation) is app
// domain data and stays in the app; it feeds `presets` and nothing more.

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Parses #rgb, #rgba, #rrggbb or #rrggbbaa (leading # optional). Alpha is 0 to 1. */
function parseHex(input: string): Rgba | null {
  let h = input.trim().replace(/^#/, "")
  if (!/^[0-9a-f]+$/i.test(h)) return null
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("")
  if (h.length !== 6 && h.length !== 8) return null
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
}

function toHex({ r, g, b, a }: Rgba, withAlpha: boolean): string {
  const p = (v: number) => Math.round(v).toString(16).padStart(2, "0")
  return `#${p(r)}${p(g)}${p(b)}${withAlpha ? p(a * 255) : ""}`
}

interface ColorFieldProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** #rrggbb or #rrggbbaa. `null` shows the empty chip and a dash. */
  value: string | null
  /** Called with a normalised lowercase hex, or null from the clear button. */
  onChange?: (value: string | null) => void
  label?: string
  /** Shows an alpha percentage field; output is #rrggbbaa. Default false. */
  alpha?: boolean
  /** Preset colours as hex. Omit for none. */
  presets?: string[]
  /** Adds a "no colour" chip to the popover that calls `onChange(null)`. */
  clearable?: boolean
  /** Shows the colour and hex but cannot change them. Also the state when `onChange` is missing. */
  readOnly?: boolean
  disabled?: boolean
  /** The colour a null value falls back to for the native picker. Default #000000. */
  fallback?: string
  /** The native picker opened or closed: the app's undo transaction boundary. */
  onPickStart?: () => void
  onPickEnd?: () => void
  /** Extra controls after the fields, e.g. an eyedropper button. */
  trailing?: React.ReactNode
}

function ColorField({
  value: valueProp,
  onChange,
  label,
  alpha = false,
  presets,
  clearable = false,
  readOnly,
  disabled,
  fallback = "#000000",
  onPickStart,
  onPickEnd,
  trailing,
  id,
  className,
  ...props
}: ColorFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const locked = !!readOnly || !onChange
  // During a picker session the field shows only the colour picked so far and ignores incoming
  // `value` props (an app that round-trips each change would fight the picker); on the picker
  // closing it re-syncs to the prop.
  const [live, setLive] = React.useState<string | null>(null)
  const value = live ?? valueProp
  const rgba = value ? parseHex(value) : null
  const shown = value ? (rgba ? toHex(rgba, alpha) : value) : ""

  const [draft, setDraft] = React.useState<string | null>(null)
  const [alphaDraft, setAlphaDraft] = React.useState<string | null>(null)

  const emit = (next: Rgba) => onChange?.(toHex(next, alpha))

  const commitHex = () => {
    if (draft === null) return
    const parsed = parseHex(draft)
    setDraft(null)
    if (!parsed) return // invalid text reverts to the current value
    // An entry without alpha digits keeps the existing alpha.
    const digits = draft.trim().replace(/^#/, "").length
    const hasAlpha = digits === 4 || digits === 8
    emit(alpha && rgba && !hasAlpha ? { ...parsed, a: rgba.a } : parsed)
  }

  const commitAlpha = () => {
    if (alphaDraft === null) return
    const pct = Number(alphaDraft)
    setAlphaDraft(null)
    if (!Number.isFinite(pct)) return
    emit({ ...(rgba ?? parseHex(fallback)!), a: Math.min(100, Math.max(0, pct)) / 100 })
  }

  const pick = (hex: string, session = false) => {
    const parsed = parseHex(hex)
    if (!parsed) return
    if (session) setLive(toHex(parsed, false))
    // Presets and the native picker carry no alpha of their own unless 8-digit.
    emit(hex.replace(/^#/, "").length === 8 || !rgba ? parsed : { ...parsed, a: rgba.a })
  }

  const swatchLabel = label ? `${label} colour` : "Colour"
  const chip = <ColorSwatch color={value} size="lg" className="size-7" />

  return (
    <div data-slot="color-field" className={cn("flex flex-col gap-1", className)} {...props}>
      {label ? (
        <label htmlFor={inputId} className="text-[11px] font-medium tracking-wide text-muted-foreground">
          {label}
        </label>
      ) : null}
      <div className={cn("flex items-center gap-2", disabled && "opacity-50")}>
        {locked || disabled ? (
          chip
        ) : !presets?.length && !clearable ? (
          // Nothing to offer but the picker: the swatch opens it directly.
          <label
            className="relative shrink-0 cursor-pointer rounded-sm focus-within:ring-1 focus-within:ring-ring"
            title={swatchLabel}
          >
            {chip}
            <input
              type="color"
              aria-label={`${swatchLabel} picker`}
              value={rgba ? toHex(rgba, false) : toHex(parseHex(fallback) ?? { r: 0, g: 0, b: 0, a: 1 }, false)}
              onChange={(e) => pick(e.target.value, true)}
              onFocus={onPickStart}
              onBlur={() => {
                setLive(null)
                onPickEnd?.()
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        ) : (
          <Popover>
            <PopoverTrigger
              aria-label={swatchLabel}
              className="shrink-0 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {chip}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto gap-2 p-2">
              {presets?.length || clearable ? (
                <div className="grid grid-cols-7 gap-1" role="group" aria-label="Presets">
                  {presets?.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={value?.toLowerCase() === c.toLowerCase()}
                      onClick={() => pick(c)}
                      className="rounded-xs outline-none hover:scale-110 focus-visible:ring-1 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground/40"
                    >
                      <ColorSwatch color={c} size="lg" />
                    </button>
                  ))}
                  {clearable ? (
                    <button
                      type="button"
                      aria-label="No colour"
                      onClick={() => onChange?.(null)}
                      className="rounded-xs outline-none hover:scale-110 focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ColorSwatch color={null} size="lg" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <input
                type="color"
                aria-label={`${swatchLabel} picker`}
                value={rgba ? toHex(rgba, false) : toHex(parseHex(fallback) ?? { r: 0, g: 0, b: 0, a: 1 }, false)}
                onChange={(e) => pick(e.target.value, true)}
                onFocus={onPickStart}
                onBlur={() => {
                  setLive(null)
                  onPickEnd?.()
                }}
                className="h-8 w-full cursor-pointer rounded-xs border border-border bg-transparent"
              />
            </PopoverContent>
          </Popover>
        )}
        <Input
          id={inputId}
          value={draft ?? (value ? shown : "")}
          placeholder="—"
          readOnly={locked}
          disabled={disabled}
          spellCheck={false}
          aria-label={label ? `${label} hex` : "Hex"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex()
            if (e.key === "Escape") setDraft(null)
          }}
          className="flex-1 font-mono"
        />
        {alpha ? (
          <div className="flex w-16 shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Input
              inputMode="numeric"
              value={alphaDraft ?? (rgba ? String(Math.round(rgba.a * 100)) : "")}
              readOnly={locked}
              disabled={disabled}
              aria-label={label ? `${label} alpha` : "Alpha"}
              onChange={(e) => setAlphaDraft(e.target.value)}
              onBlur={commitAlpha}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAlpha()
                if (e.key === "Escape") setAlphaDraft(null)
              }}
              className="text-right tabular-nums"
            />
            %
          </div>
        ) : null}
        {trailing}
      </div>
    </div>
  )
}

export { ColorField, parseHex, toHex }
export type { ColorFieldProps }
