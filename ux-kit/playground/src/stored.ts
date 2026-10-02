import { useCallback, useState } from "react"

/** useState that remembers its value in localStorage (panel widths, open state). */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`ux-kit-playground.${key}`)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // fall through to the default
    }
    return initial
  })
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(`ux-kit-playground.${key}`, JSON.stringify(v))
        } catch {
          // not remembered
        }
        return v
      })
    },
    [key],
  )
  return [value, set] as const
}
