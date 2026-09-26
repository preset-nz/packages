import { findNodeAtLocation, getLocation, parseTree } from "jsonc-parser"
import type { FieldDef, PropertySchema } from "../../src"

/**
 * Where the caret sits in the schema text, in schema terms. Palette clicks
 * insert here: a field at `insertAt` in `group`, a group after `group`. With
 * the caret outside any group, both append at the end.
 */
export interface CursorTarget {
  group: number | null
  /** Row index a new field goes in at; null means the end of the group. */
  insertAt: number | null
  /** The field the caret is on, for disabledWhen. */
  field: FieldDef | null
}

const NONE: CursorTarget = { group: null, insertAt: null, field: null }

export function cursorTarget(schema: PropertySchema, text: string, offset: number): CursorTarget {
  if (offset < 0) return NONE
  const path = getLocation(text, offset).path
  if (path[0] !== "groups" || typeof path[1] !== "number") return NONE
  const group = path[1]
  if (!schema.groups[group]) return NONE
  if (path[2] !== "rows" || typeof path[3] !== "number") return { group, insertAt: null, field: null }
  const row = path[3]
  const cell = schema.groups[group].rows[row]
  if (cell === undefined) return { group, insertAt: null, field: null }
  const field = Array.isArray(cell) ? (typeof path[4] === "number" ? cell[path[4]] : cell[0]) : cell

  // Exactly at a row, not inside it: the caret is in the gap before or after
  // that row's object. Insert into the gap.
  let insertAt = row + 1
  if (path.length === 4) {
    const tree = parseTree(text)
    const node = tree && findNodeAtLocation(tree, path)
    if (node && offset <= node.offset) insertAt = row
  }
  return { group, insertAt, field: field ?? null }
}

/** One line for the UI: where the next palette click lands. */
export function describeTarget(schema: PropertySchema, t: CursorTarget): string {
  const g = t.group ?? schema.groups.length - 1
  const group = schema.groups[g]
  if (!group) return "Inserts into a new group"
  const name = group.title ?? group.id
  const rows = group.rows
  if (t.insertAt == null || t.insertAt >= rows.length) return `Inserts at the end of ${name}`
  if (t.insertAt === 0) return `Inserts at the start of ${name}`
  const prev = rows[t.insertAt - 1]
  const prevId = Array.isArray(prev) ? prev.map((f) => f.id).join(" + ") : prev.id
  return `Inserts into ${name}, after ${prevId}`
}

/** The offset of a field's or group's `"id"` line in pretty-printed schema text. */
export function idOffset(text: string, id: string): number {
  return text.indexOf(`"id": ${JSON.stringify(id)}`)
}
