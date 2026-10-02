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
  /** Every value in the schema, resolved. */
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

export const NOTE_PREFIX = "/notes/"

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

  /** Runs a rhizome command; the commit event brings the new state back. */
  const call = useCallback(
    (cmd: string, args?: Record<string, unknown>) =>
      invoke(cmd, args).then(
        () => setError(null),
        (e) => setError(String(e)),
      ),
    [],
  )

  return { rows, history, error, call }
}
