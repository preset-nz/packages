import { Card, ToggleGroup, ToggleGroupItem } from "@preset.nz/ux-kit"

import type { Gesture, Row } from "../rhizome"
import { selectOp, useSelection } from "../selection"
import { DOC_PAGE, DocHeader } from "./Header"
import type { SetValue } from "./index"
import { OpPanel } from "./OpPanel"
import { OPS_LAYOUTS, opKind, setOpsLayout, useOpsLayout } from "./ops"
import { Selectable } from "./Selectable"

/**
 * The `ops` document: an op stack of three Oblique ops, each a facets card with its headline
 * params promoted. Selecting one shows its full panel in the inspector. The segmented control is
 * the alignment study: the same params in three label layouts. It is a view setting, not an edit.
 */
export function OpsDoc({ ops, set, gesture }: { ops: Row[]; set: SetValue; gesture: Gesture }) {
  const selection = useSelection()
  const layout = useOpsLayout()
  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Ops">
        Three of Oblique's ops with their real parameters, to judge how labels and number fields
        line up. Cards show the promoted params; select one for the full panel in the inspector.
        Edits and drags are rhizome edits, one drag one undo step.
      </DocHeader>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Label layout</span>
        <ToggleGroup
          value={[layout]}
          onValueChange={(v) => {
            const next = OPS_LAYOUTS.find((l) => l.value === v[0])
            if (next) setOpsLayout(next.value)
          }}
          variant="outline"
          spacing={0}
          aria-label="Label layout"
        >
          {OPS_LAYOUTS.map((l) => (
            <ToggleGroupItem key={l.value} value={l.value} title={l.hint} className="px-3 text-xs">
              {l.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex max-w-md flex-col gap-3 p-1">
        {ops.map((op, i) => (
          <Selectable
            key={op.id}
            selected={selection.kind === "op" && selection.id === op.id}
            onSelect={() => selectOp(op.id)}
          >
            <Card className="gap-0 overflow-hidden py-0">
              <OpPanel
                row={op}
                set={set}
                gesture={gesture}
                view="card"
                title={`${i + 1}  ${opKind(op.type)?.label ?? op.name}`}
              />
            </Card>
          </Selectable>
        ))}
      </div>
    </div>
  )
}
