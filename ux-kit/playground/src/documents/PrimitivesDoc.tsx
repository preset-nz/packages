import { Separator } from "@preset.nz/ux-kit"

import type { Gesture, Row, ValueSchema } from "../rhizome"
import { selectValue, useSelection } from "../selection"
import { ValueField } from "./fields"
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
export function PrimitivesDoc({
  row,
  set,
  gesture,
}: {
  row: Row
  set: SetValue
  gesture: Gesture
}) {
  const selection = useSelection()

  /** The row for one value key: the shared field, selectable. */
  const item = (key: string, kind: ValueSchema["kind"]) => (
    <Selectable
      selected={selection.kind === "value" && selection.key === key}
      onSelect={() => selectValue(key)}
      className="p-2"
    >
      <ValueField doc={row} valueKey={key} kind={kind} set={set} gesture={gesture} />
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
          {item("title", "text")}
          {item("notes", "text")}
        </Section>

        <Separator />

        <Section title="Boolean">
          {item("visible", "bool")}
          {item("locked", "bool")}
        </Section>

        <Separator />

        <Section title="Vector (3 floats)">{item("position", "vec3")}</Section>

        <Separator />

        <Section title="Vector (2 floats)">{item("size", "vec2")}</Section>

        <Separator />

        <Section title="Number list (4 floats)">{item("weights", "floats")}</Section>
      </div>
    </div>
  )
}
