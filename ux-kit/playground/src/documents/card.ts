import {
  registerBuiltinRenderers,
  registerScope,
  type PropertySchema,
  type Scope,
} from "@preset.nz/facets"

import { nodeScope, type NodeAdapter } from "./bound"

/**
 * The property card for a `card` node, written as facets data. Each `path` is a rhizome
 * value key, except that colour crosses as a hex string. Promote lists decide which fields the
 * card and the collapsed row show; the inspector view shows everything.
 */
export const CARD_SCHEMA: PropertySchema = {
  version: 1,
  title: "Layer",
  groups: [
    {
      id: "layer",
      title: "Layer",
      collapsible: true,
      rows: [
        { kind: "text", id: "name", label: "Name", path: "name", promote: ["card", "collapsed"] },
        [
          { kind: "checkbox", id: "visible", label: "Visible", path: "visible", promote: ["card", "collapsed"] },
          { kind: "select", id: "blend", label: "Blend", path: "blend", options: [
            { value: "normal", label: "Normal" },
            { value: "multiply", label: "Multiply" },
            { value: "screen", label: "Screen" },
            { value: "overlay", label: "Overlay" },
          ] },
        ],
        {
          kind: "slider", id: "opacity", label: "Opacity", path: "opacity", min: 0, max: 1, step: 0.01,
          disabledWhen: { path: "visible", equals: false }, promote: ["card", "collapsed"],
        },
        { kind: "color", id: "tint", label: "Tint", path: "tint", promote: ["card"] },
      ],
    },
    {
      id: "transform",
      title: "Transform",
      collapsible: true,
      rows: [
        {
          kind: "vector", id: "offset", label: "Offset", path: "offset", promote: ["card"],
          components: [{ label: "X", suffix: "px", step: 1 }, { label: "Y", suffix: "px", step: 1 }],
        },
        { kind: "number", id: "rotation", label: "Rotation", path: "rotation", min: -180, max: 180, step: 1 },
        { kind: "separator", id: "sep" },
        { kind: "label", id: "hint", label: "Offset is in pixels; rotation in degrees." },
      ],
    },
    {
      id: "notes",
      title: "Notes",
      collapsible: true,
      defaultCollapsed: true,
      rows: [{ kind: "textarea", id: "notes", label: "Notes", path: "notes", rows: 3 }],
    },
  ],
}

/** How a layer's values cross to the panel: the tint as hex. Streamed input shares one undo step per key. */
export const CARD_ADAPTER: NodeAdapter = {
  colours: ["tint"],
  streamed: new Set(["name", "notes", "opacity", "offset", "rotation", "tint"]),
}

let registered = false
/** Once, before the first panel. facets is `sideEffects: false`, so nothing registers on import. */
export function registerCardScope() {
  if (registered) return
  registered = true
  registerBuiltinRenderers()
  registerScope("card", nodeScope(CARD_SCHEMA, CARD_ADAPTER) as unknown as Scope)
}
