import { createContext, useContext } from "react"
import type { FieldDef, LabelLayout } from "./types"

/**
 * The panel's label layout, for the built-in renderers. Context rather than a renderer prop, so
 * custom renderers need no change; one that wants to follow the layout may read it with
 * `useLabelLayout()`. Outside a `PropertyPanel` it is `"auto"`.
 */
export const LabelLayoutContext = createContext<LabelLayout>("auto")
export const useLabelLayout = () => useContext(LabelLayoutContext)

/** The CSS variable that holds the label column's width in `"column"` layout. Set on the panel root. */
export const LABEL_WIDTH_VAR = "--facets-label-w"

/** The grid every `"column"` row sits on: the label, then the control. */
export const COLUMN_ROW = `grid min-h-8 grid-cols-[var(${LABEL_WIDTH_VAR})_minmax(0,1fr)] items-center gap-x-3`

/**
 * One width for every number field in a panel, whatever its label: the box is this wide in a label
 * column or under a label, and `NUMBER_WIDTH_INSIDE` when the label sits inside it (the default
 * layout, where it lines the boxes up on the right edge).
 */
export const NUMBER_WIDTH = "w-28"
export const NUMBER_WIDTH_INSIDE = "w-44 ml-auto"

/**
 * One width for the whole panel: the longest label among the fields the view draws, in `ch`,
 * kept between 8 and 16 so one long label doesn't squeeze every control. A longer label
 * truncates, with its full text as a tooltip.
 */
export function labelColumnWidth(fields: FieldDef[]): string {
  const longest = fields.reduce(
    (n, f) => (f.kind === "separator" || f.kind === "label" ? n : Math.max(n, (f.label ?? f.id).length)),
    0,
  )
  return `${Math.min(16, Math.max(8, longest))}ch`
}
