// From the crate's schema to a facets PropertySchema: one group per section,
// one field per preference. Changed values get a marker on the label, so the
// default state stays the visually quiet baseline.

import type { FieldDef, PropertySchema } from "@preset.nz/facets"
import { sectionOf, type PrefDef, type Snapshot } from "./api"

export const CHANGED_MARK = " •"

export function isDefault(snap: Snapshot, id: string): boolean {
  const def = snap.schema.prefs.find((p) => p.id === id)
  if (!def) return true
  return sameValue(snap.values[id], def.default)
}

export function sectionHasChanges(snap: Snapshot, section: string): boolean {
  return snap.schema.prefs.some(
    (p) => sectionOf(p.id) === section && !isDefault(snap, p.id),
  )
}

export function hasAnyChanges(snap: Snapshot): boolean {
  return snap.schema.prefs.some((p) => !isDefault(snap, p.id))
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i])
  }
  return a === b
}

function toField(def: PrefDef, changed: boolean): FieldDef {
  const label = changed ? def.label + CHANGED_MARK : def.label
  const base = { id: def.id, label, path: def.id }
  switch (def.kind) {
    case "bool":
      return { ...base, kind: "checkbox" }
    case "int":
      return { ...base, kind: "number", min: def.min, max: def.max, step: 1 }
    case "float":
      return { ...base, kind: "number", min: def.min, max: def.max }
    case "text":
      return { ...base, kind: "text" }
    case "select":
      return { ...base, kind: "select", options: def.options }
    case "list":
      return { ...base, kind: "string-list" }
    case "readonly_path":
      return { ...base, kind: "readonly-path" }
  }
}

export function toPropertySchema(snap: Snapshot): PropertySchema {
  return {
    version: snap.schema.version,
    groups: snap.schema.sections.map((s) => ({
      id: s.id,
      title: s.label,
      rows: snap.schema.prefs
        .filter((p) => sectionOf(p.id) === s.id)
        .map((p) => toField(p, !isDefault(snap, p.id))),
    })),
  }
}

/** Help text per id, rendered under the panel because facets fields carry none. */
export function helpFor(snap: Snapshot, section: string): Array<[string, string]> {
  return snap.schema.prefs
    .filter((p) => sectionOf(p.id) === section && p.help)
    .map((p) => [p.label, p.help as string])
}
