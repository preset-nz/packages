import type { FieldDef, PropertySchema } from "../../src"

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

// Structural checks only, enough that the panel won't throw on its way in.
// Per-kind validation is the JSON Schema's job (epic 01), not this file's.

export function parseSchema(text: string): Parsed<PropertySchema> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  if (!isObject(raw)) return fail("the schema must be an object")
  if (!Array.isArray(raw.groups)) return fail('"groups" must be an array')
  for (const [g, group] of raw.groups.entries()) {
    const at = `groups[${g}]`
    if (!isObject(group)) return fail(`${at} must be an object`)
    if (typeof group.id !== "string") return fail(`${at}.id must be a string`)
    if (!Array.isArray(group.rows)) return fail(`${at}.rows must be an array`)
    for (const [r, row] of group.rows.entries()) {
      const fields = Array.isArray(row) ? row : [row]
      for (const [f, field] of fields.entries()) {
        const where = Array.isArray(row) ? `${at}.rows[${r}][${f}]` : `${at}.rows[${r}]`
        if (!isObject(field)) return fail(`${where} must be a field object`)
        for (const key of ["kind", "id", "path"])
          if (typeof field[key] !== "string") return fail(`${where}.${key} must be a string`)
      }
    }
  }
  return { ok: true, value: raw as unknown as PropertySchema }
}

export function parseValues(text: string): Parsed<Record<string, unknown>> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  if (!isObject(raw)) return fail("the values must be an object keyed by path")
  return { ok: true, value: raw }
}

export function schemaFields(schema: PropertySchema): FieldDef[] {
  return schema.groups.flatMap((g) => g.rows.flatMap((row) => (Array.isArray(row) ? row : [row])))
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}
