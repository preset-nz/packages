import { Separator } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"
import { selectValue, useSelection } from "../selection"
import { BoolField, NumberField, nums, SliderField, TextField, withAt } from "./fields"
import { DocHeader } from "./Header"
import type { SetValue } from "./index"
import { Selectable } from "./Selectable"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

/**
 * A `primitives` node: a boolean, text, a vec3 (one Input per component), a vec2 and a
 * four-float list (one Slider per component). Each control commits one labelled rhizome edit.
 * Each value is one selectable row; the inspector follows it.
 */
export function PrimitivesDoc({ row, set }: { row: Row; set: SetValue }) {
  const selection = useSelection()
  const v = row.values ?? {}
  const put = (key: string, value: unknown) => set(row.path, key, value)
  const position = nums(v.position, 3)
  const size = nums(v.size, 2)
  const weights = nums(v.weights, 4)

  /** The row for one value key. */
  const item = (key: string, children: React.ReactNode) => (
    <Selectable
      selected={selection.kind === "value" && selection.key === key}
      onSelect={() => selectValue(key)}
      className="p-2"
    >
      {children}
    </Selectable>
  )

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <DocHeader title="Primitives">
        One node with a value of each kind. Every change is a labelled edit: undo, redo and History
        follow. Select a row to inspect that value.
      </DocHeader>

      <Section title="Text">
        {item("title", <TextField label="Title" value={String(v.title ?? "")} onCommit={(t) => put("title", t)} />)}
        {item(
          "notes",
          <TextField label="Notes" value={String(v.notes ?? "")} multiline onCommit={(t) => put("notes", t)} />,
        )}
      </Section>

      <Separator />

      <Section title="Boolean">
        {item("visible", <BoolField label="Visible" value={v.visible === true} onCommit={(b) => put("visible", b)} />)}
        {item("locked", <BoolField label="Locked" value={v.locked === true} onCommit={(b) => put("locked", b)} />)}
      </Section>

      <Separator />

      <Section title="Vector (3 floats)">
        {item(
          "position",
          <div className="flex gap-3">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <NumberField
                key={axis}
                label={axis}
                value={position[i]}
                onCommit={(n) => put("position", withAt(position, i, n))}
              />
            ))}
          </div>,
        )}
      </Section>

      <Separator />

      <Section title="Vector (2 floats)">
        {item(
          "size",
          <div className="flex flex-col gap-3">
            {(["Width", "Height"] as const).map((name, i) => (
              <SliderField
                key={name}
                label={name}
                value={size[i]}
                max={100}
                onCommit={(n) => put("size", withAt(size, i, n))}
              />
            ))}
          </div>,
        )}
      </Section>

      <Separator />

      <Section title="Number list (4 floats)">
        {item(
          "weights",
          <div className="flex flex-col gap-3">
            {weights.map((w, i) => (
              <SliderField
                key={i}
                label={`Weight ${i + 1}`}
                value={w}
                max={1}
                onCommit={(n) => put("weights", withAt(weights, i, n))}
              />
            ))}
          </div>,
        )}
      </Section>
    </div>
  )
}
