import { useEffect, useState } from "react"

/**
 * The current values of some colour tokens, for drawing on a canvas, which can't read CSS
 * variables. Read again when the theme changes: the `.dark` class or a style on `<html>`, or
 * the system appearance.
 */
export function useTokenColours<K extends string>(names: readonly K[]): Record<K, string> {
  const key = names.join(",")
  const [colours, setColours] = useState(() => read(names))
  useEffect(() => {
    const list = key.split(",") as K[]
    const update = () => setColours(read(list))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", update)
    return () => {
      observer.disconnect()
      media.removeEventListener("change", update)
    }
  }, [key])
  return colours
}

function read<K extends string>(names: readonly K[]): Record<K, string> {
  const style = getComputedStyle(document.documentElement)
  const out = {} as Record<K, string>
  for (const name of names) out[name] = style.getPropertyValue(`--${name}`).trim() || "currentColor"
  return out
}
