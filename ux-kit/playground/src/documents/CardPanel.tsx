import type { PanelView } from "@preset.nz/facets"

import type { Gesture, Row } from "../rhizome"
import { CARD_ADAPTER, registerCardScope } from "./card"
import { NodePanel } from "./NodePanel"
import type { SetValue } from "./index"

registerCardScope()

/** A facets panel bound to one `layer` node, in the view given. */
export function CardPanel({
  row,
  set,
  gesture,
  view,
  title,
}: {
  row: Row
  set: SetValue
  gesture?: Gesture
  view: PanelView
  title?: string
}) {
  return <NodePanel scopeKey="card" adapter={CARD_ADAPTER} row={row} set={set} gesture={gesture} view={view} title={title} />
}
