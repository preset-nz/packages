import { getLocation } from "jsonc-parser"
import type { FieldDef, PropertySchema } from "../../src"

/**
 * Where the caret sits in the schema text, in schema terms. Palette clicks
 * insert here: a field goes after the row holding the caret, a group after the
 * group holding it. With the caret outside any group, both append at the end.
 */
export interface CursorTarget {
  group: number | null
  row: number | null
  field: FieldDef | null
}

export function cursorTarget(schema: PropertySchema, text: string, offset: number): CursorTarget {
  const none = { group: null, row: null, field: null }
  if (offset < 0) return none
  const path = getLocation(text, offset).path
  if (path[0] !== "groups" || typeof path[1] !== "number") return none
  const group = path[1]
  if (!schema.groups[group]) return none
  if (path[2] !== "rows" || typeof path[3] !== "number") return { group, row: null, field: null }
  const row = path[3]
  const cell = schema.groups[group].rows[row]
  if (cell === undefined) return { group, row: null, field: null }
  // A paired row: the fifth segment picks the field within it.
  const field = Array.isArray(cell) ? (typeof path[4] === "number" ? cell[path[4]] : cell[0]) : cell
  return { group, row, field: field ?? null }
}

/** The offset of a field's or group's `"id"` line in pretty-printed schema text. */
export function idOffset(text: string, id: string): number {
  return text.indexOf(`"id": ${JSON.stringify(id)}`)
}
