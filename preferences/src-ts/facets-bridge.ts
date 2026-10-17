// From the crate's schema to a facets PropertySchema: one group per section,
// one field per preference, its help drawn under it by facets. Pages and
// advanced sections map across as facets' pages and advanced groups, so facets
// draws the tabs and the Advanced row.
// Changed values are marked by facets from `changedPaths`, so the default
// state stays the visually quiet baseline.

import type { FieldDef, PropertySchema } from "@preset.nz/facets"
import { type PrefDef, type Snapshot, sectionOf } from "./api"

export function isDefault(snap: Snapshot, id: string): boolean {
  const def = snap.schema.prefs.find((p) => p.id === id)
  if (!def) return true
  return sameValue(snap.values[id], def.default)
}

export function sectionHasChanges(snap: Snapshot, section: string): boolean {
  return snap.schema.prefs.some((p) => sectionOf(p.id) === section && !isDefault(snap, p.id))
}

export function hasAnyChanges(snap: Snapshot): boolean {
  return snap.schema.prefs.some((p) => !isDefault(snap, p.id))
}

/** The ids whose values differ from their defaults: facets' `Scope.changed`. */
export function changedPaths(snap: Snapshot): string[] {
  return snap.schema.prefs.filter((p) => !isDefault(snap, p.id)).map((p) => p.id)
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i])
  }
  return a === b
}

function toField(def: PrefDef): FieldDef {
  const base = {
    id: def.id,
    label: def.label,
    path: def.id,
    ...(def.help ? { help: def.help } : {}),
  }
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

/**
 * The facets schema for the whole window. A schema without pages maps to one
 * without `pages` (one page, no tabs); facets' validation then holds because
 * the crate's own refuses the same bad declarations at load.
 */
export function toPropertySchema(snap: Snapshot): PropertySchema {
  const { version, pages = [], sections, prefs } = snap.schema
  const paged = pages.length > 0
  return {
    version,
    ...(paged ? { pages: pages.map(({ id, label }) => ({ id, label })) } : {}),
    groups: sections.map((s) => ({
      id: s.id,
      title: s.label,
      rows: prefs.filter((p) => sectionOf(p.id) === s.id).map(toField),
      ...(paged && s.page ? { page: s.page } : {}),
      ...(s.advanced ? { advanced: true } : {}),
    })),
  }
}
