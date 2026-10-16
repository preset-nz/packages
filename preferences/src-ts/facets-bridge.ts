// From the crate's schema to a facets PropertySchema: one group per section,
// one field per preference. Changed values get a marker on the label, so the
// default state stays the visually quiet baseline.
//
// Pages split the sections into tabs, and each page splits again into the
// sections it always shows and the advanced ones behind its disclosure.

import type { FieldDef, PropertySchema } from "@preset.nz/facets"
import { type PrefDef, type PrefPage, type PrefSection, type Snapshot, sectionOf } from "./api"

export const CHANGED_MARK = " •"

export function isDefault(snap: Snapshot, id: string): boolean {
  const def = snap.schema.prefs.find((p) => p.id === id)
  if (!def) return true
  return sameValue(snap.values[id], def.default)
}

export function sectionHasChanges(snap: Snapshot, section: string): boolean {
  return snap.schema.prefs.some((p) => sectionOf(p.id) === section && !isDefault(snap, p.id))
}

/** A page as the window draws it: its sections split by disclosure level. */
export type PageView = {
  page: PrefPage
  basic: PrefSection[]
  advanced: PrefSection[]
}

/** Id of the one page a schema without pages gets. Never shown. */
export const IMPLICIT_PAGE = ""

/**
 * The pages in declared order. A schema without pages gets one implicit page
 * holding every section, so the window has a single code path.
 */
export function pageViews(snap: Snapshot): PageView[] {
  const { pages = [], sections } = snap.schema
  const declared = pages.length > 0 ? pages : [{ id: IMPLICIT_PAGE, label: "" }]
  return declared.map((page) => {
    const on = sections.filter((s) => pages.length === 0 || s.page === page.id)
    return {
      page,
      basic: on.filter((s) => !s.advanced),
      advanced: on.filter((s) => s.advanced),
    }
  })
}

export function sectionsHaveChanges(snap: Snapshot, sections: PrefSection[]): boolean {
  return sections.some((s) => sectionHasChanges(snap, s.id))
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

/** The facets schema for `sections`; every section when none are given. */
export function toPropertySchema(snap: Snapshot, sections?: PrefSection[]): PropertySchema {
  return {
    version: snap.schema.version,
    groups: (sections ?? snap.schema.sections).map((s) => ({
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
