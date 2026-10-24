import { useEffect, useRef, useState } from "react"
import type { FileFieldDef, FileFilter } from "./types"

/** What the user chose in the file field's context menu. */
export type FileMenuChoice = "reveal" | "clear"

/**
 * The native half of the `file` field, supplied by the host so facets depends on neither Tauri
 * nor app-kit. app-kit's functions have exactly these shapes: `recent: recentPaths`,
 * `remember: rememberPath`, `pick: pickFile`, `exists: pathsExist`, `reveal: revealPath`,
 * `contextMenu: pathFieldMenu`. Every member is optional; a field uses what the host gave it
 * and is a plain editable text field when it gave none.
 */
export interface FileHandlers {
  /** The recent paths of a field kind (`recentKey`), newest first. Feeds the ▾ list. */
  recent?: (key: string) => Promise<string[]>
  /**
   * Put a path at the top of a kind's recent list. Called once the host has accepted a commit
   * (the field's value became the committed path), never for a refused one.
   */
  remember?: (key: string, path: string) => void | Promise<void>
  /** The native Open dialog: the absolute path chosen, or null when cancelled. Feeds the browse icon. */
  pick?: (opts: { filters?: FileFilter[]; title?: string }) => Promise<string | null>
  /**
   * Whether each path exists, in order. Relative paths resolve against `base`. Gone recents are
   * left out of the ▾ list, and the current value shows Missing; both are re-checked when the
   * window regains focus.
   */
  exists?: (paths: string[], base?: string) => Promise<boolean[]>
  /** Show the file in the Finder. */
  reveal?: (path: string, base?: string) => void | Promise<void>
  /**
   * A native menu at the pointer (Reveal in Finder, Clear). Resolves to the choice, or null when
   * dismissed. Without it the field has no context menu of its own.
   */
  contextMenu?: (opts: { missing: boolean; canClear?: boolean }) => Promise<FileMenuChoice | null>
  /** The folder relative paths resolve against: the document's. Read when a field checks or reveals. */
  base?: () => string | undefined
}

let handlers: FileHandlers | null = null
const listeners = new Set<() => void>()

/**
 * Register the host's file handlers, once at startup (like `registerFieldRenderer`): every `file`
 * field in every panel then works the same way. Pass `null` to remove them. Replaces any earlier
 * registration; fields already drawn pick the change up.
 */
export function registerFileHandlers(next: FileHandlers | null): void {
  handlers = next
  for (const l of listeners) l()
}

export function getFileHandlers(): FileHandlers | null {
  return handlers
}

/** The registered handlers, re-read if they are registered again while the field is drawn. */
export function useFileHandlers(): FileHandlers | null {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return handlers
}

/**
 * The Open dialog's filters for a field: `filters`, else the extensions in the deprecated
 * `accept` (`".png,.jpg,image/*"` gives one "Files" filter of png and jpg), else none.
 */
export function filtersOf(
  field: Pick<FileFieldDef, "filters" | "accept">,
): FileFilter[] | undefined {
  if (field.filters?.length) return field.filters
  const extensions = (field.accept ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\.[^./\\*]+$/.test(t))
    .map((t) => t.slice(1))
  return extensions.length ? [{ name: "Files", extensions }] : undefined
}

/**
 * Whether the path is gone: false until the check says so, re-run when the path or base changes
 * and whenever the window regains focus, so a file put back recovers without a click. Always
 * false without an `exists` handler or a path.
 */
export function useMissing(path: string | null, h: FileHandlers | null): boolean {
  const [missing, setMissing] = useState(false)
  const exists = h?.exists
  const base = h?.base?.()
  useEffect(() => {
    if (!exists || !path) {
      setMissing(false)
      return
    }
    let live = true
    const check = () =>
      exists([path], base).then(
        (found) => live && setMissing(found[0] === false),
        () => {},
      )
    void check()
    window.addEventListener("focus", check)
    return () => {
      live = false
      window.removeEventListener("focus", check)
    }
  }, [exists, path, base])
  return missing
}

/**
 * The ▾ list: the host's recent paths for a key with the gone ones left out (all of them when
 * the host has no `exists`). Loaded on mount, whenever `refreshOn` changes and when the window
 * regains focus. Returns the list and a function that reloads it.
 */
export function useRecent(
  key: string | undefined,
  h: FileHandlers | null,
  refreshOn: unknown,
): [string[], () => Promise<void>] {
  const [list, setList] = useState<string[]>([])
  const recent = h?.recent
  const exists = h?.exists
  const base = h?.base?.()
  const latest = useRef(0)
  const reload = useRef<() => Promise<void>>(async () => {})
  reload.current = async () => {
    if (!recent || !key) {
      setList([])
      return
    }
    const ticket = ++latest.current
    try {
      const all = await recent(key)
      const found = exists && all.length ? await exists(all, base) : undefined
      if (ticket === latest.current) setList(found ? all.filter((_, i) => found[i] !== false) : all)
    } catch {
      if (ticket === latest.current) setList([])
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload is read through the ref; these are what should trigger it
  useEffect(() => {
    void reload.current()
    const onFocus = () => void reload.current()
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      latest.current++
    }
  }, [key, recent, exists, base, refreshOn])
  return [list, () => reload.current()]
}
