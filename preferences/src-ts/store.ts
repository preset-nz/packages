// One module-level snapshot, hydrated on first use and kept current by the
// change event. Components subscribe through useSyncExternalStore, so a write
// from anywhere (the window, a menu command, a hand-edit followed by reset)
// reaches every reader without prop plumbing.

import { useCallback, useEffect, useSyncExternalStore } from "react"
import {
  getPreferences,
  onPreferencesChanged,
  resetPreferences,
  setPreference,
  type PrefValue,
  type Snapshot,
} from "./api"

let snapshot: Snapshot | null = null
let hydrating: Promise<void> | null = null
let listening = false
const subscribers = new Set<() => void>()

function publish(next: Snapshot) {
  snapshot = next
  for (const s of subscribers) s()
}

function ensureHydrated(): Promise<void> {
  if (snapshot) return Promise.resolve()
  if (!hydrating) {
    hydrating = getPreferences()
      .then(publish)
      .catch((e) => {
        console.error("preferences: initial load failed:", e)
      })
      .finally(() => {
        hydrating = null
      })
  }
  return hydrating
}

function ensureListening() {
  if (listening) return
  listening = true
  void onPreferencesChanged(publish)
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  ensureListening()
  void ensureHydrated()
  return () => {
    subscribers.delete(cb)
  }
}

function read(): Snapshot | null {
  return snapshot
}

/** The whole snapshot, or null before the first load resolves. */
export function usePreferences(): Snapshot | null {
  return useSyncExternalStore(subscribe, read, read)
}

/**
 * One value by id. Falls back to the schema default before load, and to
 * `fallback` if the id is unknown to the running app.
 */
export function usePreference<T extends PrefValue>(id: string, fallback: T): T {
  const snap = usePreferences()
  if (!snap) return fallback
  const v = snap.values[id]
  if (v !== undefined) return v as T
  const def = snap.schema.prefs.find((p) => p.id === id)
  return (def?.default as T | undefined) ?? fallback
}

/** Imperative write and reset, stable across renders. */
export function usePreferenceActions() {
  const set = useCallback((id: string, value: PrefValue) => {
    return setPreference(id, value).then(publish)
  }, [])
  const reset = useCallback((section?: string) => {
    return resetPreferences(section).then(publish)
  }, [])
  return { set, reset }
}

/** Mount once near the root so the snapshot is warm before any window opens. */
export function usePreferencesBootstrap(): void {
  useEffect(() => {
    ensureListening()
    void ensureHydrated()
  }, [])
}

/** Non-hook read for code outside React (menu handlers, one-off checks). */
export function currentPreferences(): Snapshot | null {
  return snapshot
}
