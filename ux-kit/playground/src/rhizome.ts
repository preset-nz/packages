import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

// The shapes of rhizome-core's `Row`, `Commit` and the playground's HistoryState as they
// serialise. Only what the app reads. The commands are in src-tauri/src/doc.rs.
export type Row = {
  id: string
  path: string
  name: string
  type: string
  role: "root" | "category" | "group" | "node" | "opaque"
  /** Every value in the schema, resolved, as the file format writes it (colour is [r, g, b, a]). */
  values?: Record<string, unknown>
}
export type Commit = { seq: number; label: string }
export type History = {
  undo_label: string | null
  redo_label: string | null
  history_len: number
  undo_labels: string[] // oldest first
  redo_labels: string[] // next first
}

export const DOC_PREFIX = "/documents/"

export const fetchRows = () => invoke<Row[]>("rhizome_rows")

export function useRhizome() {
  const [rows, setRows] = useState<Row[]>([])
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    Promise.all([fetchRows(), invoke<History>("rhizome_history")])
      .then(([r, h]) => {
        setRows(r)
        setHistory(h)
      })
      .catch((e) => setError(String(e)))
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

  return { rows, history, error, call, set }
}
