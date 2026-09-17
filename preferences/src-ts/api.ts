// The wire between the crate and the frontend. Types mirror
// `preset_preferences::{Schema, Snapshot}`; the crate serialises them, so
// nothing here is declared twice by an app.

import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export type PrefValue = boolean | number | string | string[]

export type PrefKind =
  | { kind: "bool" }
  | { kind: "int"; min?: number; max?: number }
  | { kind: "float"; min?: number; max?: number }
  | { kind: "text" }
  | { kind: "select"; options: Array<{ value: string; label: string }> }
  | { kind: "list" }
  | { kind: "readonly_path" }

export type PrefDef = PrefKind & {
  id: string
  label: string
  help?: string
  default: PrefValue
}

export type PrefSection = { id: string; label: string }

export type PrefSchema = {
  version: number
  sections: PrefSection[]
  prefs: PrefDef[]
}

export type Snapshot = {
  schema: PrefSchema
  values: Record<string, PrefValue>
  path: string
}

export const CHANGED_EVENT = "preferences://changed"

export function getPreferences(): Promise<Snapshot> {
  return invoke<Snapshot>("preferences_get")
}

export function setPreference(id: string, value: PrefValue): Promise<Snapshot> {
  return invoke<Snapshot>("preferences_set", { id, value })
}

export function resetPreferences(section?: string): Promise<Snapshot> {
  return invoke<Snapshot>("preferences_reset", { section: section ?? null })
}

export function onPreferencesChanged(
  cb: (snapshot: Snapshot) => void,
): Promise<UnlistenFn> {
  return listen<Snapshot>(CHANGED_EVENT, (e) => cb(e.payload))
}

export function sectionOf(id: string): string {
  return id.split(".", 1)[0] ?? id
}
