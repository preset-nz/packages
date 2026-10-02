import type { Row } from "../rhizome"
import type { Selection } from "../selection"

/** What Reset acts on: a node, and the keys to reset (all of them when absent). */
export interface ResetTarget {
  path: string
  keys?: string[]
}

/**
 * Reset acts on the selection: the selected value, or the selected layer. With no item selected
 * it acts on the open document. Either `target` is set, or `reason` says why nothing can be reset.
 */
export function resetTarget(
  doc: Row | null,
  sel: Selection,
  layers: Row[],
): { target: ResetTarget; reason?: undefined } | { target: null; reason: string } {
  if (!doc) return { target: null, reason: "No document is open" }
  switch (sel.kind) {
    case "value":
      return doc.set?.includes(sel.key)
        ? { target: { path: doc.path, keys: [sel.key] } }
        : { target: null, reason: `${sel.key} is already at its default` }
    case "layer": {
      const layer = layers.find((l) => l.id === sel.id)
      return layer?.set?.length
        ? { target: { path: layer.path } }
        : { target: null, reason: "This layer is already at its defaults" }
    }
    case "token":
    case "font":
      return { target: null, reason: "Tokens and fonts are read-only" }
    default:
      if (doc.type === "primitives")
        return doc.set?.length
          ? { target: { path: doc.path } }
          : { target: null, reason: "Every value is already at its default" }
      return { target: null, reason: "Select a value or layer to reset" }
  }
}
