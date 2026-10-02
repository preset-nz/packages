import { useId } from "react"
import { Checkbox, Input, Label, Separator, Slider, Textarea } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"
import { DocHeader } from "./Header"
import type { SetValue } from "./index"
import { useDraft } from "./useDraft"

const nums = (v: unknown, n: number): number[] =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number") ? v : Array(n).fill(0)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

/** A checkbox with its label. One click is one edit. */
function BoolField({ label, value, onCommit }: { label: string; value: boolean; onCommit: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={value} onCheckedChange={(v) => onCommit(v === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

/** Text typed freely, committed as one edit on blur or Enter; Escape puts the value back. */
function TextField({
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
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
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
function SliderField({
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

/**
 * A `primitives` node: a boolean, text, a vec3 (one Input per component), a vec2 and a
 * four-float list (one Slider per component). Each control commits one labelled rhizome edit.
 */
export function PrimitivesDoc({ row, set }: { row: Row; set: SetValue }) {
  const v = row.values ?? {}
  const put = (key: string, value: unknown) => set(row.path, key, value)
  const position = nums(v.position, 3)
  const size = nums(v.size, 2)
  const weights = nums(v.weights, 4)
  const withAt = (list: number[], i: number, n: number) => list.map((x, j) => (j === i ? n : x))

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <DocHeader title="Primitives">
        One node with a value of each kind. Every change is a labelled edit: undo, redo and History
        follow.
      </DocHeader>

      <Section title="Text">
        <TextField label="Title" value={String(v.title ?? "")} onCommit={(t) => put("title", t)} />
        <TextField label="Notes" value={String(v.notes ?? "")} multiline onCommit={(t) => put("notes", t)} />
      </Section>

      <Separator />

      <Section title="Boolean">
        <BoolField label="Visible" value={v.visible === true} onCommit={(b) => put("visible", b)} />
        <BoolField label="Locked" value={v.locked === true} onCommit={(b) => put("locked", b)} />
      </Section>

      <Separator />

      <Section title="Vector (3 floats)">
        <div className="flex gap-3">
          {(["X", "Y", "Z"] as const).map((axis, i) => (
            <NumberField
              key={axis}
              label={axis}
              value={position[i]}
              onCommit={(n) => put("position", withAt(position, i, n))}
            />
          ))}
        </div>
      </Section>

      <Separator />

      <Section title="Vector (2 floats)">
        {(["Width", "Height"] as const).map((name, i) => (
          <SliderField
            key={name}
            label={name}
            value={size[i]}
            max={100}
            onCommit={(n) => put("size", withAt(size, i, n))}
          />
        ))}
      </Section>

      <Separator />

      <Section title="Number list (4 floats)">
        {weights.map((w, i) => (
          <SliderField
            key={i}
            label={`Weight ${i + 1}`}
            value={w}
            max={1}
            onCommit={(n) => put("weights", withAt(weights, i, n))}
          />
        ))}
      </Section>
    </div>
  )
}
