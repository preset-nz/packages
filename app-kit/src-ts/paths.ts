import { invoke } from "@tauri-apps/api/core"
import { useEffect, useState } from "react"

/** One file type in the Open dialog. Extensions have no dot: `["png", "jpg"]`. */
export interface PickFilter {
  name: string
  extensions: string[]
}

export interface PickFileOptions {
  title?: string
  filters?: PickFilter[]
  /** A folder the dialog starts in; ignored when it does not exist. */
  startDir?: string
}

/** The last paths chosen for a field kind (`"texture"`), newest first, at most 10, across documents. As written, never canonicalised. */
export function recentPaths(key: string): Promise<string[]> {
  return invoke<string[]>("app_kit_recent_paths", { key })
}

/**
 * Put a path at the top of a kind's recent list. Call it once the app has accepted the commit,
 * whether the path was picked, typed or dropped; `pickFile` does not remember what it returns.
 */
export function rememberPath(key: string, path: string): Promise<void> {
  return invoke<void>("app_kit_remember_path", { key, path })
}

/** The native Open dialog: the absolute path chosen, or null when cancelled. Feeds `PathField`'s `onBrowse`. */
export function pickFile(opts: PickFileOptions = {}): Promise<string | null> {
  return invoke<string | null>("app_kit_pick_file", {
    title: opts.title,
    filters: opts.filters,
    startDir: opts.startDir,
  })
}

/** Show the file in the Finder, selected. A relative path resolves against `base`, a directory. Rejects if the file is missing. */
export function revealPath(path: string, base?: string): Promise<void> {
  return invoke<void>("app_kit_reveal_path", { path, base })
}

/** Whether each path exists, in order. Relative paths resolve against `base`, a directory. */
export function pathsExist(paths: string[], base?: string): Promise<boolean[]> {
  return invoke<boolean[]>("app_kit_paths_exist", { paths, base })
}

/**
 * Whether each path is missing, in order: checked on mount, when `paths` or `base` change and
 * whenever the window regains focus, so a file put back recovers without a click. A path is
 * not missing until the check says so (the first render is all false). Memoise nothing: the
 * list is compared by content.
 */
export function useMissingCheck(paths: string[], base?: string): boolean[] {
  const [missing, setMissing] = useState<boolean[]>(() => paths.map(() => false))
  const signature = JSON.stringify(paths)
  useEffect(() => {
    let live = true
    const list: string[] = JSON.parse(signature)
    const check = () => {
      if (list.length === 0) return setMissing([])
      pathsExist(list, base).then(
        (found) => live && setMissing(found.map((f) => !f)),
        () => {},
      )
    }
    check()
    window.addEventListener("focus", check)
    return () => {
      live = false
      window.removeEventListener("focus", check)
    }
  }, [signature, base])
  return missing
}

export interface PathFieldMenuOptions {
  /** The file is gone: "Reveal in Finder" is shown off. */
  missing: boolean
  /** False when there is nothing to clear (an empty or read-only field): "Clear" is shown off. Default true. */
  canClear?: boolean
}

/**
 * A native context menu at the pointer for a path field: Reveal in Finder (off when missing) and
 * Clear. Resolves to what was chosen, or `null` when it was dismissed. The caller acts on it
 * (`revealPath`, commit an empty value). Pop it from the field's `contextmenu` handler after
 * `preventDefault()`, but not while the text is being edited: there the text menu belongs.
 */
export function pathFieldMenu(opts: PathFieldMenuOptions): Promise<"reveal" | "clear" | null> {
  return invoke<"reveal" | "clear" | null>("app_kit_path_field_menu", {
    missing: opts.missing,
    canClear: opts.canClear,
  })
}
