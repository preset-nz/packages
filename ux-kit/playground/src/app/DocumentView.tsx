import { EmptyState, Icons } from "@preset.nz/ux-kit"

import { CardDoc } from "../documents/CardDoc"
import { FontsDoc } from "../documents/FontsDoc"
import { PrimitivesDoc } from "../documents/PrimitivesDoc"
import { TokensDoc } from "../documents/TokensDoc"
import type { SetValue } from "../documents"
import type { Row } from "../rhizome"

/** The centre: the open document, drawn by what kind of node it is. */
export function DocumentView({ doc, layers, set }: { doc: Row | null; layers: Row[]; set: SetValue }) {
  switch (doc?.type) {
    case "tokens":
      return <TokensDoc />
    case "fonts":
      return <FontsDoc />
    case "primitives":
      return <PrimitivesDoc row={doc} set={set} />
    case "card":
      return <CardDoc layers={layers} set={set} />
    default:
      return (
        <EmptyState
          icon={<Icons.FilesIcon />}
          title="No document"
          description="Pick a document in the outline."
        />
      )
  }
}
