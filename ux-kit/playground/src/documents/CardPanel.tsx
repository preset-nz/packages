import { useEffect, useMemo, useRef, useState } from "react"
import { PropertyPanel } from "@preset.nz/facets"

import type { Gesture, Row } from "../rhizome"
import { cardValues, registerCardScope, type CardContext } from "./card"
import type { SetValue } from "./index"

registerCardScope()

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A facets panel bound to one `layer` node, in the view given: `card` in the centre,
 * `inspector` in the right-hand panel. Edits go through rhizome.
 */
export function CardPanel({
  row,
  set,
  gesture,
  view,
  title,
}: {
  row: Row
  set: SetValue
  /** Without it a drag is a run of coalesced `set`s. */
  gesture?: Gesture
  view: "card" | "inspector" | "collapsed"
  title?: string
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  // Keep a typed draft only until rhizome's value for that key changes (accepted, undone, redone),
  // or the panel is bound to another node.
  const previous = useRef({ id: row.id, values: cardValues(row) })
  useEffect(() => {
    const now = cardValues(row)
    const before = previous.current
    previous.current = { id: row.id, values: now }
    setDraft((d) =>
      before.id !== row.id
        ? {}
        : Object.fromEntries(Object.entries(d).filter(([k]) => same(before.values[k], now[k]))),
    )
  }, [row])

  const gesturing = useRef(false)
  const ctx = useMemo<CardContext>(
    () => ({
      set: (path, key, value, coalesce) => set(path, key, value, coalesce),
      setDraft: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
      gesture,
      gesturing,
    }),
    [set, gesture],
  )
  const selection = useMemo(() => ({ row, draft }), [row, draft])
  return <PropertyPanel scopeKey="card" selection={selection} ctx={ctx} view={view} title={title} />
}
