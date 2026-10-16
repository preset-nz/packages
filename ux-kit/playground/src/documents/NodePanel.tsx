import { type LabelLayout, type PanelView, PropertyPanel } from "@preset.nz/facets"
import { useEffect, useMemo, useRef, useState } from "react"

import type { Gesture, Row } from "../rhizome"
import { type NodeAdapter, type NodeContext, panelValues } from "./bound"
import type { SetValue } from "./index"

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A facets panel bound to one node through a registered scope, in the view given: `card` in the
 * centre, `inspector` in the right-hand panel. Edits go through rhizome. Typed input stays a draft
 * until rhizome's value for that key changes (accepted, undone, redone) or the panel is bound to
 * another node.
 */
export function NodePanel({
  scopeKey,
  adapter,
  row,
  set,
  gesture,
  view,
  title,
  labelLayout,
}: {
  scopeKey: string
  adapter: NodeAdapter
  row: Row
  set: SetValue
  /** Without it a drag is a run of coalesced `set`s. */
  gesture?: Gesture
  view: PanelView
  title?: string
  labelLayout?: LabelLayout
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  const previous = useRef({ id: row.id, values: panelValues(row, adapter) })
  useEffect(() => {
    const now = panelValues(row, adapter)
    const before = previous.current
    previous.current = { id: row.id, values: now }
    setDraft((d) =>
      before.id !== row.id
        ? {}
        : Object.fromEntries(Object.entries(d).filter(([k]) => same(before.values[k], now[k]))),
    )
  }, [row, adapter])

  const gesturing = useRef(false)
  const ctx = useMemo<NodeContext>(
    () => ({
      set: (path, key, value, coalesce) => set(path, key, value, coalesce),
      setDraft: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
      gesture,
      gesturing,
    }),
    [set, gesture],
  )
  const selection = useMemo(() => ({ row, draft }), [row, draft])
  return (
    <PropertyPanel
      scopeKey={scopeKey}
      selection={selection}
      ctx={ctx}
      view={view}
      title={title}
      labelLayout={labelLayout}
    />
  )
}
