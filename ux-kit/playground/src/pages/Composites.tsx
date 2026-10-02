import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { Button } from "@preset.nz/ux-kit"

// The shapes of rhizome-core's `Row` and `Commit` as they serialise. Only what this page reads.
type Row = {
  id: string
  path: string
  name: string
  type: string
  role: "root" | "category" | "group" | "node" | "opaque"
}
type Commit = { seq: number; label: string }
// Tree::undo_label, Tree::redo_label, Tree::history_len, Tree::undo_labels, Tree::redo_labels.
type History = {
  undo_label: string | null
  redo_label: string | null
  history_len: number
  undo_labels: string[] // oldest first
  redo_labels: string[] // next first
}

const NOTE_PREFIX = "/notes/"

export function Composites() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    Promise.all([invoke<Row[]>("rhizome_rows"), invoke<History>("rhizome_history")])
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

  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(cmd, args).then(() => setError(null), (e) => setError(String(e)))

  const notes = rows?.filter((r) => r.path.startsWith(NOTE_PREFIX)) ?? []
  // Keep the set of notes stable on screen; a counter gives each body edit a new value.
  const stamp = () => `Edited ${new Date().toLocaleTimeString()}`

  return (
    <section>
      <h1 className="font-heading text-2xl font-semibold">Composites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Placeholder. Edits on an in-memory rhizome tree; undo and redo are the tree's own history
        (Edit menu, Cmd+Z / Cmd+Shift+Z).
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => call("rhizome_add_note")}>
          Add note
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!history?.undo_label}
          onClick={() => call("rhizome_undo")}
        >
          Undo
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!history?.redo_label}
          onClick={() => call("rhizome_redo")}
        >
          Redo
        </Button>
      </div>

      {rows && (
        <ul className="mt-4 space-y-1 font-mono text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span>
                {r.path} <span className="text-muted-foreground">{r.type} ({r.role})</span>
              </span>
              {notes.includes(r) && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      call("rhizome_set_body", { path: r.path, body: stamp() })
                    }
                  >
                    Set body
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      call("rhizome_rename", { path: r.path, name: `${r.name}-renamed` })
                    }
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => call("rhizome_remove", { path: r.path })}
                  >
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 font-heading text-lg font-semibold">History</h2>
      {history && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 font-mono text-sm">
          <dt className="text-muted-foreground">undo</dt>
          <dd>{history.undo_label ?? "nothing"}</dd>
          <dt className="text-muted-foreground">redo</dt>
          <dd>{history.redo_label ?? "nothing"}</dd>
          <dt className="text-muted-foreground">steps kept</dt>
          <dd>{history.history_len}</dd>
        </dl>
      )}
      {history && (
        <ol className="mt-4 space-y-0.5 font-mono text-sm">
          {history.undo_labels.map((label, i) => (
            <li key={`u${i}`}>
              <span className="text-muted-foreground">{i + 1}</span> {label}
            </li>
          ))}
          <li className="text-primary">— now —</li>
          {history.redo_labels.map((label, i) => (
            <li key={`r${i}`} className="text-muted-foreground">
              {history.history_len + i + 1} {label}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
