import { Card } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"
import { selectLayer, useSelection } from "../selection"
import { CardPanel } from "./CardPanel"
import { DocHeader } from "./Header"
import type { SetValue } from "./index"
import { Selectable } from "./Selectable"

/**
 * The `card` document: three `layer` nodes, each drawn as a facets card. Selecting one binds
 * the inspector's full panel to that node; both edit the same rhizome values.
 */
export function CardDoc({ layers, set }: { layers: Row[]; set: SetValue }) {
  const selection = useSelection()
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <DocHeader title="Card">
        Layers drawn by facets from one schema, each bound to its own rhizome node. Select a card and
        the inspector shows its full panel; edit in either place.
      </DocHeader>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] items-start gap-3 p-1">
        {layers.map((layer) => (
          <Selectable
            key={layer.id}
            selected={selection.kind === "layer" && selection.id === layer.id}
            onSelect={() => selectLayer(layer.id)}
          >
            {/* facets' card view brings its own header and padding; the kit Card is only the frame */}
            <Card className="gap-0 overflow-hidden py-0">
              <CardPanel row={layer} set={set} view="card" title={String(layer.values?.name ?? layer.name)} />
            </Card>
          </Selectable>
        ))}
      </div>
    </div>
  )
}
