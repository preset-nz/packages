import { useCallback, useEffect, useState } from "react"

const KEY = "ux-kit-playground.dark"

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v !== null) return v === "1"
  } catch {
    // storage unavailable: follow the system
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Dark mode for this window; windows share it through localStorage and the storage event. */
export function useTheme() {
  const [dark, setDark] = useState(read)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setDark(read())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem(KEY, d ? "0" : "1")
      } catch {
        // not remembered
      }
      return !d
    })
  }, [])

  return { dark, toggle }
}
