import { useCallback, useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

// The shapes of rhizome-core's `Row` and `Commit` as they
// serialise. Only what the app reads. The commands are in src-tauri/src/doc.rs.
export type Row = {
  id: string
  path: string
  name: string
  type: string
  role: "root" | "category" | "group" | "node" | "opaque"
  /** Every value in the schema, resolved, as the file format writes it (colour is [r, g, b, a]). */
  values?: Record<string, unknown>
  /** The value keys actually stored; the rest read as their defaults. */
  set?: string[]
}
/** One value in a node type's schema (rhizome-core's `ValueSchema`), as `rhizome_schema` returns it. */
export type ValueSchema = {
  key: string
  kind: "bool" | "int" | "float" | "text" | "choice" | "vec2" | "vec3" | "colour" | "floats" | "shaped"
  default: unknown
  range?: [number, number]
  choices?: string[]
}
export type Schema = { types: { name: string; values?: ValueSchema[] }[] }
export type Commit = { seq: number; label: string }
/** The gesture verbs, bound to the one open tree. One gesture at a time. */
export type Gesture = {
  begin: (path: string, key: string) => void
  apply: (path: string, key: string, value: unknown) => void
  end: () => void
  cancel: () => void
}

export const DOC_PREFIX = "/documents/"

export const LAYER_PREFIX = "/layers/"

export const fetchRows = () => invoke<Row[]>("rhizome_rows")

export function useRhizome() {
  const [rows, setRows] = useState<Row[]>([])
  const [schema, setSchema] = useState<Schema | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    fetchRows().then(setRows, (e) => setError(String(e)))
  }, [])

  useEffect(() => {
    // The registry doesn't change while the app runs: once.
    invoke<Schema>("rhizome_schema").then(setSchema, (e) => setError(String(e)))
  }, [])

  useEffect(() => {
    refresh()
    const un = listen<Commit>("rhizome://commit", refresh)
    return () => {
      un.then((f) => f())
    }
  }, [refresh])

  /** Runs a rhizome command and returns its result; the commit event brings the new state back. */
  const call = useCallback(
    <T = unknown>(cmd: string, args?: Record<string, unknown>) =>
      invoke<T>(cmd, args).then(
        (v) => {
          setError(null)
          return v
        },
        (e) => {
          setError(String(e))
          return undefined
        },
      ),
    [],
  )

  /**
   * Sets one value on a node: one labelled edit. `coalesce` is for streamed input (typing,
   * a nudge): consecutive sets of the same key share one undo step.
   */
  const set = useCallback(
    (path: string, key: string, value: unknown, coalesce = false) =>
      call("rhizome_set", { path, key, value, coalesce }),
    [call],
  )

  /**
   * A drag as a rhizome gesture (`Tree::begin` / `apply` / `end` / `cancel`): `apply` shows at
   * once, and the whole drag is one undo step at `end`. rhizome keeps the gesture id.
   */
  const gesture = useMemo<Gesture>(
    () => ({
      begin: (path, key) => void call("rhizome_gesture_begin", { path, key }),
      apply: (path, key, value) => void call("rhizome_gesture_apply", { path, key, value }),
      end: () => void call("rhizome_gesture_end"),
      cancel: () => void call("rhizome_gesture_cancel"),
    }),
    [call],
  )

  return { rows, schema, error, call, set, gesture }
}
