import { useId } from "react"
import { Checkbox, Input, Label, Slider, Textarea } from "@preset.nz/ux-kit"

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

/** One number: the typed text is kept until blur or Enter, then it is one edit. */
export function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const id = useId()
  const [text, setText] = useDraft(String(value))
  const commit = () => {
    const n = Number(text)
    if (text.trim() === "" || !Number.isFinite(n)) setText(String(value))
    else if (n !== value) onCommit(n)
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setText(String(value))
        }}
        className="tabular-nums"
      />
    </div>
  )
}

/** One slider: dragging shows the value, letting go (or a key press) is the edit. */
export function SliderField({
  label,
  value,
  max,
  onCommit,
}: {
  label: string
  value: number
  max: number
  onCommit: (v: number) => void
}) {
  const id = useId()
  const [local, setLocal] = useDraft(value)
  return (
    <div className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Slider
        id={id}
        min={0}
        max={max}
        step={max / 100}
        value={local}
        onValueChange={(v) => setLocal(v as number)}
        onValueCommitted={(v) => onCommit(v as number)}
      />
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {local.toFixed(2)}
      </span>
    </div>
  )
}


/** A list of `n` numbers from a rhizome value; zeros when it isn't one. */
export const nums = (v: unknown, n: number): number[] =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number") ? v : Array(n).fill(0)

export const withAt = (list: number[], i: number, n: number) => list.map((x, j) => (j === i ? n : x))
