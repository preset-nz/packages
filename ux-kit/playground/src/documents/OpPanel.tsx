import type { PanelView } from "@preset.nz/facets"

import type { Gesture, Row } from "../rhizome"
import { NodePanel } from "./NodePanel"
import { opKind, opScopeKey, registerOpScopes, useOpsLayout } from "./ops"
import type { SetValue } from "./index"

registerOpScopes()

/** A facets panel bound to one op node, laid out as the Ops document's segmented control says. */
export function OpPanel({
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
  const layout = useOpsLayout()
  const kind = opKind(row.type)
  if (!kind) return null
  return (
    <NodePanel
      scopeKey={opScopeKey(kind.type)}
      adapter={kind.adapter}
      row={row}
      set={set}
      gesture={gesture}
      view={view}
      title={title ?? kind.label}
      labelLayout={layout}
    />
  )
}
