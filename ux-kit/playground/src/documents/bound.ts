import type { Scope } from "@preset.nz/facets"

import { colourToHex, hexToColour } from "../colour"
import type { Gesture, Row } from "../rhizome"

/**
 * A facets scope bound to one rhizome node: the part of the Card document that isn't about layers,
 * so the Ops document can use it too. A panel path is a rhizome value key, except where the
 * adapter says otherwise.
 */

/** What facets holds as the selection: the node, plus values typed but not yet accepted. */
export interface NodeSelection {
  row: Row
  /** In the panel's terms (colour as hex, a group as one array), keyed by path. */
  draft: Record<string, unknown>
}

/** What the scope's `write` reaches. `ctx` is the host's: here, one rhizome set and the draft. */
export interface NodeContext {
  set: (path: string, key: string, value: unknown, coalesce: boolean) => void
  setDraft: (key: string, value: unknown) => void
  /** rhizome's gesture verbs, and whether a drag is open (writes then `apply` instead of `set`). */
  gesture?: Gesture
  gesturing?: { current: boolean }
}

/** How a node's values cross to the panel and back. */
export interface NodeAdapter {
  /** Colour values, which cross as hex strings. */
  colours?: string[]
  /** Whole-number values: a write is rounded, as Oblique's `snapToIntegerStep` does. */
  ints?: string[]
  /** A panel path that stands for several rhizome keys, in order: `angles` for the four screen angles. */
  groups?: Record<string, string[]>
  /** Panel paths whose input streams (typing, dragging) and so shares one undo step; a toggle or pick is its own. */
  streamed: Set<string>
}

/** The node's values in the panel's terms. */
export function panelValues(row: Row, a: NodeAdapter): Record<string, unknown> {
  const v: Record<string, unknown> = { ...(row.values ?? {}) }
  for (const k of a.colours ?? []) v[k] = colourToHex(v[k])
  for (const [path, keys] of Object.entries(a.groups ?? {})) v[path] = keys.map((k) => v[k])
  return v
}

const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n)

/** One panel write as rhizome writes: `[key, value]` pairs, or none while the input is half typed. */
function writes(
  a: NodeAdapter,
  path: string,
  value: unknown,
  current: Record<string, unknown>,
): Array<[string, unknown]> {
  const keys = a.groups?.[path]
  if (keys) {
    // Only the component that moved: each keeps its own range check, and a drag edits one key.
    if (!Array.isArray(value) || !value.every(finite)) return []
    const before = current[path] as unknown[]
    return keys.flatMap((k, i): Array<[string, unknown]> => (value[i] === before[i] ? [] : [[k, value[i]]]))
  }
  if (a.colours?.includes(path)) {
    const c = typeof value === "string" ? hexToColour(value) : null
    return c ? [[path, c]] : []
  }
  if (Array.isArray(value)) return value.every(finite) ? [[path, value]] : []
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return []
    return [[path, a.ints?.includes(path) ? Math.round(value) : value]]
  }
  return value === null || value === undefined ? [] : [[path, value]]
}

export function nodeScope(
  schema: Scope["schema"],
  a: NodeAdapter,
): Scope<NodeSelection, Record<string, unknown>> {
  const draftOf = (sel: NodeSelection) => ({ ...panelValues(sel.row, a), ...sel.draft })
  const scope: Scope<NodeSelection, Record<string, unknown>> = {
    schema,
    read: draftOf,
    write: (path, value, sel, ctx: NodeContext) => {
      // Show what was typed at once; the draft drops away when rhizome's value moves.
      ctx.setDraft(path, value)
      const streamed = a.streamed.has(path)
      for (const [key, out] of writes(a, path, value, draftOf(sel))) {
        if (ctx.gesture && ctx.gesturing?.current) ctx.gesture.apply(sel.row.path, key, out)
        else ctx.set(sel.row.path, key, out, streamed)
      }
    },
    // A scrub, slider drag or colour pick: live applies, one undo step.
    gesture: {
      begin: (path, sel, ctx: NodeContext) => {
        if (!ctx.gesture) return
        ctx.gesturing!.current = true
        ctx.gesture.begin(sel.row.path, path)
      },
      end: (_path, _sel, ctx: NodeContext) => {
        if (!ctx.gesture) return
        ctx.gesturing!.current = false
        ctx.gesture.end()
      },
      cancel: (_path, _sel, ctx: NodeContext) => {
        if (!ctx.gesture) return
        ctx.gesturing!.current = false
        ctx.gesture.cancel()
      },
    },
  }
  return scope
}
