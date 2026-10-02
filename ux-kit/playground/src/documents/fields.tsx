import { useId } from "react"
import { Checkbox, Input, Label, Textarea, VectorField, type VectorFieldProps } from "@preset.nz/ux-kit"

import type { Gesture, Row, ValueSchema } from "../rhizome"
import type { SetValue } from "./index"
import { useDraft } from "./useDraft"

/** A checkbox with its label. One click is one edit. */
export function BoolField({ label, value, onCommit }: { label: string; value: boolean; onCommit: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={value} onCheckedChange={(v) => onCommit(v === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

/** Text typed freely, committed as one edit on blur or Enter; Escape puts the value back. */
export function TextField({
  label,
  value,
  multiline,
  onCommit,
}: {
  label: string
  value: string
  multiline?: boolean
  onCommit: (v: string) => void
}) {
  const id = useId()
  const [text, setText] = useDraft(value)
  const commit = () => text !== value && onCommit(text)
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={text}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setText(value)
          }}
        />
      )}
    </div>
  )
}

/**
 * A rhizome list value (vec2, vec3, floats) as a row of drag-to-adjust fields. A drag is one
 * gesture: live edits, one undo step, Escape puts it back. A typed number, or an arrow key, is
 * a plain labelled edit (arrow-key runs share one step).
 */
export function NumbersField({
  path,
  valueKey,
  values,
  set,
  gesture,
  orientation,
  ...props
}: {
  path: string
  valueKey: string
  values: number[]
  set: SetValue
  gesture: Gesture
} & Omit<VectorFieldProps, "value" | "onValueChange" | "onScrubStart" | "onScrubEnd" | "onScrubCancel">) {
  return (
    <VectorField
      {...props}
      orientation={orientation}
      value={values}
      onValueChange={(next, { reason }) =>
        reason === "scrub" ? gesture.apply(path, valueKey, next) : set(path, valueKey, next, reason === "step")
      }
      onScrubStart={() => gesture.begin(path, valueKey)}
      onScrubEnd={gesture.end}
      onScrubCancel={gesture.cancel}
    />
  )
}

/** A list of `n` numbers from a rhizome value; zeros when it isn't one. */
export const nums = (v: unknown, n: number): number[] =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number") ? v : Array(n).fill(0)

export const withAt = (list: number[], i: number, n: number) => list.map((x, j) => (j === i ? n : x))

/** How a value key is presented, wherever it is edited: the label, its component names, step and range. */
const VIEW: Record<string, { label: string; labels?: string[]; step?: number; min?: number; max?: number; multiline?: boolean }> = {
  title: { label: "Title" },
  notes: { label: "Notes", multiline: true },
  visible: { label: "Visible" },
  locked: { label: "Locked" },
  position: { label: "Position", labels: ["X", "Y", "Z"], step: 0.1 },
  size: { label: "Size", labels: ["W", "H"], step: 0.5, min: 0, max: 100 },
  weights: { label: "Weights", labels: ["1", "2", "3", "4"], step: 0.01, min: 0, max: 1 },
}

/**
 * The editor for one rhizome value, chosen by its kind. The document and the inspector both
 * render this, so a value is edited by the same component, with the same gesture and undo wiring,
 * wherever it appears. `orientation` is the only thing a caller decides: the layout.
 */
export function ValueField({
  doc,
  valueKey,
  kind,
  set,
  gesture,
  orientation,
}: {
  doc: Row
  valueKey: string
  kind: ValueSchema["kind"]
  set: SetValue
  gesture: Gesture
  orientation?: "row" | "column"
}) {
  const current = doc.values?.[valueKey]
  const view = VIEW[valueKey] ?? { label: valueKey }
  const put = (value: unknown) => set(doc.path, valueKey, value)
  switch (kind) {
    case "bool":
      return <BoolField label={view.label} value={current === true} onCommit={put} />
    case "text":
      return <TextField label={view.label} value={String(current ?? "")} multiline={view.multiline} onCommit={put} />
    case "vec2":
    case "vec3":
    case "floats": {
      const n = kind === "vec2" ? 2 : kind === "vec3" ? 3 : (view.labels?.length ?? 4)
      return (
        <NumbersField
          path={doc.path}
          valueKey={valueKey}
          values={nums(current, n)}
          set={set}
          gesture={gesture}
          labels={view.labels ?? Array.from({ length: n }, (_, i) => String(i + 1))}
          orientation={orientation}
          step={view.step}
          min={view.min}
          max={view.max}
        />
      )
    }
    default:
      return <p className="text-xs text-muted-foreground">No editor for {kind} values.</p>
  }
}
