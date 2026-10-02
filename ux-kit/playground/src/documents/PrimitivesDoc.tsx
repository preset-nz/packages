import { Separator } from "@preset.nz/ux-kit"

import type { Gesture, Row } from "../rhizome"
import { selectValue, useSelection } from "../selection"
import { BoolField, NumbersField, nums, TextField } from "./fields"
import { DOC_PAGE, DocHeader } from "./Header"
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
 * A `primitives` node: a boolean, text, a vec3, a vec2 and a four-float list (one drag-to-adjust
 * field per component). Each control commits one labelled rhizome edit; a drag is one gesture.
 * Each value is one selectable row; the inspector follows it.
 */
export function PrimitivesDoc({ row, set, gesture }: { row: Row; set: SetValue; gesture: Gesture }) {
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
    <div className={DOC_PAGE}>
      <DocHeader title="Primitives">
        One node with a value of each kind. Every change is a labelled edit: undo, redo and History
        follow. Select a row to inspect that value.
      </DocHeader>
      <div className="flex max-w-xl flex-col gap-6">

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
          <NumbersField path={row.path} valueKey="position" values={position} set={set} gesture={gesture} step={0.1} />,
        )}
      </Section>

      <Separator />

      <Section title="Vector (2 floats)">
        {item(
          "size",
          <NumbersField
            path={row.path}
            valueKey="size"
            values={size}
            set={set}
            gesture={gesture}
            labels={["W", "H"]}
            min={0}
            max={100}
            step={0.5}
          />,
        )}
      </Section>

      <Separator />

      <Section title="Number list (4 floats)">
        {item(
          "weights",
          <NumbersField
            path={row.path}
            valueKey="weights"
            values={weights}
            set={set}
            gesture={gesture}
            labels={["1", "2", "3", "4"]}
            min={0}
            max={1}
            step={0.01}
          />,
        )}
      </Section>
      </div>
    </div>
  )
}
