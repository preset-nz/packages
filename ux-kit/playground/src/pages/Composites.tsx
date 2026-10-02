import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

// The shape of rhizome-core's `Row` as it serialises. Only what this page reads.
type Row = {
  id: string
  path: string
  name: string
  type: string
  role: "root" | "category" | "group" | "node" | "opaque"
}

export function Composites() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<Row[]>("rhizome_rows")
      .then(setRows)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <section>
      <h1 className="font-heading text-2xl font-semibold">Composites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Placeholder. The tree comes later; for now, the nodes of an in-memory rhizome tree.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {rows && (
        <ul className="mt-4 space-y-1 font-mono text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              {r.path} <span className="text-muted-foreground">{r.type} ({r.role})</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
