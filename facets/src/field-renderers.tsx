/* eslint-disable react-refresh/only-export-components --
 * This module ships the built-in field renderers as small co-located
 * components plus a single `registerBuiltinRenderers` entry point. Splitting
 * each renderer into its own file would be over-organisation for code that
 * never hot-reloads in isolation. */
import { useMemo, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { NumberField } from "@/components/ui/number-field"
import { Slider } from "@/components/ui/slider"
import { ColorField } from "@/components/ui/color-field"
import { registerFieldRenderer } from "./registry"
import { COLUMN_ROW, useLabelLayout } from "./layout"
import type {
  CheckboxFieldDef,
  ColorFieldDef,
  FieldRenderer,
  FieldRendererProps,
  NumberFieldDef,
  SelectFieldDef,
  SliderFieldDef,
  TextFieldDef,
  TextareaFieldDef,
  FileFieldDef,
  LabelFieldDef,
  PanelView,
  SeparatorFieldDef,
  VectorFieldDef,
} from "./types"

function ReadOnlyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-8 px-0 py-1 text-xs text-foreground tabular-nums break-all">
      {children}
    </div>
  )
}

function Empty() {
  return <span className="text-muted-foreground">—</span>
}

function FieldShell({
  label,
  view,
  top,
  children,
}: {
  label?: string
  view?: PanelView
  /** In a label column: align the label to the top of a tall control. */
  top?: boolean
  children: React.ReactNode
}) {
  const layout = useLabelLayout()
  // Collapsed: one compact row, label in a fixed column beside the control.
  if (view === "collapsed") {
    return (
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
        <Label className="truncate text-[11px] font-medium text-muted-foreground tracking-wide">
          {label}
        </Label>
        <div className="min-w-0">{children}</div>
      </div>
    )
  }
  // Column: one label column shared by the panel, the control on a common edge.
  if (layout === "column") {
    return (
      <div className={top ? COLUMN_ROW.replace("items-center", "items-start") : COLUMN_ROW}>
        <Label
          title={label}
          className={
            "block truncate text-[11px] font-medium text-muted-foreground tracking-wide" +
            (top ? " pt-2" : "")
          }
        >
          {label}
        </Label>
        <div className="min-w-0">{children}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <Label className="text-[11px] font-medium text-muted-foreground tracking-wide">
          {label}
        </Label>
      )}
      {children}
    </div>
  )
}

/** Decimal places a step implies: 0.05 gives 2, 5 gives 0. */
function placesOf(step: number): number {
  const s = String(step)
  if (s.includes("e-")) return Number(s.split("e-")[1])
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

function formatPrimitive(value: unknown): string {
  if (value == null || value === "") return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const TextRenderer: FieldRenderer<TextFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
}) => {
  const display = formatPrimitive(value)
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      {onChange ? (
        <Input
          aria-label={field.label ?? field.id}
          value={display}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : display ? (
        <ReadOnlyText>{display}</ReadOnlyText>
      ) : (
        <ReadOnlyText>
          <Empty />
        </ReadOnlyText>
      )}
    </FieldShell>
  )
}

const TextareaRenderer: FieldRenderer<TextareaFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
}) => {
  const display = formatPrimitive(value)
  return (
    <FieldShell label={field.label ?? field.id} view={view} top>
      {onChange ? (
        <textarea
          aria-label={field.label ?? field.id}
          value={display}
          rows={view === "collapsed" ? 1 : (field.rows ?? 3)}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      ) : display ? (
        <ReadOnlyText>
          <span className="whitespace-pre-wrap">{display}</span>
        </ReadOnlyText>
      ) : (
        <ReadOnlyText>
          <Empty />
        </ReadOnlyText>
      )}
    </FieldShell>
  )
}

const NumberRenderer: FieldRenderer<NumberFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  onGestureBegin,
  onGestureEnd,
  onGestureCancel,
}) => {
  const layout = useLabelLayout()
  const num =
    typeof value === "number"
      ? value
      : value != null && value !== ""
      ? Number(value)
      : null
  const finite = num != null && Number.isFinite(num)
  const label = field.label ?? field.id
  if (!onChange) {
    return (
      <FieldShell label={label}>
        <ReadOnlyText>{finite ? num.toLocaleString() : <Empty />}</ReadOnlyText>
      </FieldShell>
    )
  }
  // The field's own label is the scrub handle, so the panel draws none beside it: in "column" and
  // "stacked" it tells the field where to put it. Hosts that ignore labelPlacement keep it inside.
  const placed =
    layout === "auto"
      ? {}
      : { labelPlacement: layout === "column" ? ("column" as const) : ("above" as const), suffix: field.suffix }
  const input = (
    <NumberField
      label={label}
      value={finite ? num : (field.min ?? 0)}
      min={field.min}
      max={field.max}
      step={field.step ?? 1}
      integer={field.integer}
      {...placed}
      disabled={disabled}
      onValueChange={(next) => onChange(next)}
      onScrubStart={onGestureBegin}
      onScrubEnd={onGestureEnd}
      onScrubCancel={onGestureCancel}
    />
  )
  // The field spans the label and control columns of a row of its own.
  return layout === "column" ? <div className={COLUMN_ROW}>{input}</div> : input
}

const SliderRenderer: FieldRenderer<SliderFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
  onGestureBegin,
  onGestureEnd,
}) => {
  const num = typeof value === "number" ? value : Number(value ?? 0)
  // A drag is a pointer press that moves the value; arrow keys are plain edits.
  const pressed = useRef(false)
  const dragging = useRef(false)
  const layout = useLabelLayout()
  // With labels in a column or above, the value reads out to the right, on a shared edge.
  const readout = layout !== "auto" && view !== "collapsed"
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      {onChange ? (
        <div
          className={readout ? "flex items-center gap-2 py-1" : "py-1"}
          onPointerDownCapture={() => {
            pressed.current = true
          }}
        >
          <Slider
            className={readout ? "min-w-0 flex-1" : undefined}
            aria-label={field.label ?? field.id}
            value={Number.isFinite(num) ? num : (field.min ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            onValueChange={(next) => {
              if (pressed.current && !dragging.current) {
                dragging.current = true
                onGestureBegin?.()
              }
              onChange(Array.isArray(next) ? next[0] : next)
            }}
            onValueCommitted={() => {
              pressed.current = false
              if (dragging.current) {
                dragging.current = false
                onGestureEnd?.()
              }
            }}
          />
          {readout && (
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {Number.isFinite(num) ? num.toFixed(placesOf(field.step ?? 1)) : ""}
            </span>
          )}
        </div>
      ) : (
        <ReadOnlyText>
          {Number.isFinite(num) ? num.toLocaleString() : <Empty />}
        </ReadOnlyText>
      )}
    </FieldShell>
  )
}

const SelectRenderer: FieldRenderer<SelectFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  ctx,
  view,
}) => {
  const options = useMemo(
    () => (field.optionsProvider ? field.optionsProvider(ctx) : (field.options ?? [])),
    [field, ctx],
  )
  const current = value == null ? "" : String(value)
  const matched = options.find((o) => o.value === current)
  if (!onChange) {
    return (
      <FieldShell label={field.label ?? field.id} view={view}>
        <ReadOnlyText>
          {matched ? matched.label : current ? current : <Empty />}
        </ReadOnlyText>
      </FieldShell>
    )
  }
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <Select
        value={current}
        onValueChange={(v) => onChange(v)}
        disabled={disabled}
      >
        <SelectTrigger>
          {/* Children, not the primitive's own lookup: Base UI's Value shows
              the raw value unless it's told the label. */}
          <SelectValue>{matched ? matched.label : current}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

const ColorRenderer: FieldRenderer<ColorFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
  onGestureBegin,
  onGestureEnd,
}) => {
  const hex = typeof value === "string" && value.length > 0 ? value : null
  const label = field.label ?? field.id
  const layout = useLabelLayout()
  // Collapsed rows and a label column keep the label in their column; otherwise the field draws it.
  const inColumn = view === "collapsed" || layout === "column"
  const picker = (
    <ColorField
      label={inColumn ? undefined : label}
      value={hex}
      presets={field.presets}
      disabled={disabled}
      onChange={onChange ? (next) => onChange(next ?? "") : undefined}
      onPickStart={onGestureBegin}
      onPickEnd={onGestureEnd}
    />
  )
  return inColumn ? (
    <FieldShell label={label} view={view}>
      {picker}
    </FieldShell>
  ) : (
    picker
  )
}

const CheckboxRenderer: FieldRenderer<CheckboxFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
}) => {
  const checked = Boolean(value)
  const layout = useLabelLayout()
  if (!onChange) {
    return (
      <FieldShell label={field.label ?? field.id} view={view}>
        <ReadOnlyText>{checked ? "Yes" : "No"}</ReadOnlyText>
      </FieldShell>
    )
  }
  // Collapsed rows and a label column keep the label in their column, like every other kind.
  if (view === "collapsed" || layout === "column") {
    return (
      <FieldShell label={field.label ?? field.id} view={view}>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onChange(Boolean(next))}
        />
      </FieldShell>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(Boolean(next))}
      />
      {field.label && (
        <Label className="text-xs text-foreground">{field.label}</Label>
      )}
    </div>
  )
}

const FileRenderer: FieldRenderer<FileFieldDef> = ({
  field,
  value,
  view,
}) => {
  const asset = value as { name?: string } | null | undefined
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <ReadOnlyText>
        {asset?.name ? asset.name : <Empty />}
      </ReadOnlyText>
    </FieldShell>
  )
}

function toNumberArray(value: unknown, arity: number): Array<number | null> {
  if (!Array.isArray(value)) return Array.from({ length: arity }, () => null)
  return Array.from({ length: arity }, (_, i) => {
    const v = value[i]
    if (v == null || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  })
}

function formatComponent(
  n: number | null,
  integer: boolean,
  precision?: number,
): string {
  if (n == null) return ""
  if (integer) return Math.trunc(n).toLocaleString()
  if (precision != null) return n.toFixed(precision)
  return n.toLocaleString()
}

const AXES = ["X", "Y", "Z", "W"]

const VectorRenderer: FieldRenderer<VectorFieldDef> = ({
  field,
  value,
  disabled,
  onChange,
  view,
  onGestureBegin,
  onGestureEnd,
  onGestureCancel,
}) => {
  const layout = useLabelLayout()
  const arity = field.components.length
  const values = toNumberArray(value, arity)
  const isInt = Boolean(field.integer)

  if (!onChange) {
    return (
      <FieldShell label={field.label ?? field.id} view={view}>
        <div
          className="grid gap-x-3 gap-y-1"
          style={{ gridTemplateColumns: `repeat(${arity}, minmax(0, 1fr))` }}
        >
          {field.components.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5 min-w-0">
              {c.label && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </span>
              )}
              <div className="text-xs text-foreground tabular-nums truncate">
                {values[i] == null ? (
                  <Empty />
                ) : (
                  <>
                    {formatComponent(values[i], isInt, field.precision)}
                    {c.suffix && (
                      <span className="text-muted-foreground">{c.suffix}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </FieldShell>
    )
  }

  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <div
        className="grid gap-x-1"
        style={{ gridTemplateColumns: `repeat(${arity}, minmax(0, 1fr))` }}
      >
        {field.components.map((c, i) => (
          <NumberField
            key={i}
            label={c.label ?? AXES[i] ?? String(i + 1)}
            value={values[i] ?? c.min ?? 0}
            min={c.min}
            max={c.max}
            step={c.step ?? (isInt ? 1 : 0.01)}
            integer={isInt}
            precision={field.precision}
            suffix={layout === "auto" ? undefined : c.suffix}
            disabled={disabled}
            onValueChange={(next) => {
              const out = values.map((v) => v ?? 0)
              out[i] = isInt ? Math.trunc(next) : next
              onChange(out)
            }}
            onScrubStart={onGestureBegin}
            onScrubEnd={onGestureEnd}
            onScrubCancel={onGestureCancel}
          />
        ))}
      </div>
    </FieldShell>
  )
}

const SeparatorRenderer: FieldRenderer<SeparatorFieldDef> = ({ field, view }) =>
  view === "collapsed" ? null : field.label ? (
    <div className="my-1 flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {field.label}
      </span>
      <Separator className="flex-1" />
    </div>
  ) : (
    <Separator className="my-1" />
  )

// The same in every mode: there is nothing to edit. Greys out under
// disabledWhen so a hint can follow the field it describes.
const LabelRenderer: FieldRenderer<LabelFieldDef> = ({ field, disabled }) => (
  <p
    className={
      "text-xs text-muted-foreground" + (disabled ? " opacity-50" : "")
    }
  >
    {field.label}
  </p>
)

export function registerBuiltinRenderers(): void {
  registerFieldRenderer(
    "separator",
    SeparatorRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "label",
    LabelRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "text",
    TextRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "textarea",
    TextareaRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "number",
    NumberRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "slider",
    SliderRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "select",
    SelectRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "color",
    ColorRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "checkbox",
    CheckboxRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "file",
    FileRenderer as FieldRenderer<import("./types").FieldDef>,
  )
  registerFieldRenderer(
    "vector",
    VectorRenderer as FieldRenderer<import("./types").FieldDef>,
  )
}

export type {
  FieldRenderer,
  FieldRendererProps,
}
