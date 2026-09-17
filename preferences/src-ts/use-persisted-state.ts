// `useState` that survives a relaunch, for UI ephemera only: which sections
// are folded, a panel width, the last tab. Not for preferences, which belong
// in the TOML file, and not for anything a document should remember.
//
// Lifted from Strata (guidance `design/persisted-ui-state.md`) so all three
// value lifetimes come from one package. localStorage can be missing or
// throw, so every read and write is guarded and the app behaves the same
// without it, just forgetfully.
//
// Keys are `<app>.<surface>.<thing>`; the app prefix is mandatory.

import { useCallback, useEffect, useRef, useState } from "react"

export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  const latest = useRef(value)
  latest.current = value

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueRaw((prev) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next
      latest.current = resolved
      return resolved
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(latest.current))
    } catch {
      // Quota or serialisation failure. UI state is lossy by nature.
    }
  }, [key, value])

  return [value, setValue]
}
