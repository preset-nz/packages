import {
  registerBuiltinRenderers,
  registerScope,
  type PropertySchema,
  type Scope,
} from "@preset.nz/facets"

import { colourToHex, hexToColour } from "../colour"
import type { Row } from "../rhizome"

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

/** What facets holds as the selection: the node, plus values typed but not yet accepted. */
export interface CardSelection {
  row: Row
  /** In the panel's terms (colour as hex), keyed by path. */
  draft: Record<string, unknown>
}

/** What the scope's `write` reaches. `ctx` is the host's: here, one rhizome set and the draft. */
export interface CardContext {
  set: (path: string, key: string, value: unknown, coalesce: boolean) => void
  setDraft: (key: string, value: unknown) => void
}

/** The node's values in the panel's terms: rhizome's, with the colour as hex. */
export function cardValues(row: Row): Record<string, unknown> {
  const v = row.values ?? {}
  return { ...v, tint: colourToHex(v.tint) }
}

// Streamed input (typing, dragging) shares one undo step per key; a toggle or a pick is its own.
const STREAMED = new Set(["name", "notes", "opacity", "offset", "rotation", "tint"])

const card: Scope<CardSelection, Record<string, unknown>> = {
  schema: CARD_SCHEMA,
  read: (sel) => ({ ...cardValues(sel.row), ...sel.draft }),
  write: (path, value, sel, ctx: CardContext) => {
    // Show what was typed at once; the draft drops away when rhizome's value moves.
    ctx.setDraft(path, value)
    // Half-typed input is not a value yet: keep it in the draft, edit nothing.
    let out = value
    if (path === "tint") {
      out = typeof value === "string" ? hexToColour(value) : null
    } else if (Array.isArray(value)) {
      if (!value.every((n) => typeof n === "number" && Number.isFinite(n))) return
    } else if (typeof value === "number" && !Number.isFinite(value)) {
      return
    }
    if (out === null || out === undefined) return
    ctx.set(sel.row.path, path, out, STREAMED.has(path))
  },
}

let registered = false
/** Once, before the first panel. facets is `sideEffects: false`, so nothing registers on import. */
export function registerCardScope() {
  if (registered) return
  registered = true
  registerBuiltinRenderers()
  registerScope("card", card as unknown as Scope)
}
