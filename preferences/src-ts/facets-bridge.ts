// From the crate's schema to a facets PropertySchema: one group per section,
// one field per preference. Pages and advanced sections map across as facets'
// pages and advanced groups, so facets draws the tabs and the Advanced row.
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
  const base = { id: def.id, label: def.label, path: def.id }
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
 * A section's help, as its group's description: facets fields carry no help of
 * their own. One preference with help reads as its help alone; several name
 * the preference each sentence belongs to.
 */
function sectionHelp(prefs: PrefDef[]): string | undefined {
  const helped = prefs.filter((p) => p.help)
  if (helped.length === 0) return undefined
  if (helped.length === 1) return helped[0].help
  return helped.map((p) => `${p.label}: ${p.help}`).join(" ")
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
    groups: sections.map((s) => {
      const own = prefs.filter((p) => sectionOf(p.id) === s.id)
      const description = sectionHelp(own)
      return {
        id: s.id,
        title: s.label,
        rows: own.map(toField),
        ...(description ? { description } : {}),
        ...(paged && s.page ? { page: s.page } : {}),
        ...(s.advanced ? { advanced: true } : {}),
      }
    }),
  }
}
