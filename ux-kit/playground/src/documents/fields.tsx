import { useId } from "react"
import { Checkbox, Input, Label, Textarea, VectorField, type VectorFieldProps } from "@preset.nz/ux-kit"

import type { Gesture } from "../rhizome"
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
