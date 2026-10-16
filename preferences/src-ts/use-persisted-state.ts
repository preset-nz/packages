// `useState` that survives a relaunch, for UI ephemera only: which sections
// are folded, a panel width, the last tab. Not for preferences, which belong
// in the TOML file, and not for anything a document should remember.
//
// Lifted from Strata (guidance `design/persisted-ui-state.md`) so all three
// value lifetimes come from one package. localStorage can be missing or
// throw, so every read and write is guarded and the app behaves the same
// without it, just forgetfully.
//
// Keys are `<app>.<surface>.<thing>`; the app prefix is mandatory. A null key
// keeps the state in memory only, so a component can make persistence opt-in
// without calling a different hook.

import { useCallback, useEffect, useState } from "react"

export function usePersistedState<T>(
  key: string | null,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() => {
    if (key === null) return initial
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueRaw((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next
      return resolved
    })
  }, [])

  useEffect(() => {
    if (key === null) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Quota or serialisation failure. UI state is lossy by nature.
    }
  }, [key, value])

  return [value, setValue]
}
