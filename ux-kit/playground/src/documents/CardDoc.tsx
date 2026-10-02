import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PropertyPanel } from "@preset.nz/facets"
import { Card, CardContent } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"
import { cardValues, registerCardScope, type CardContext } from "./card"
import { DocHeader } from "./Header"
import type { SetValue } from "./index"

registerCardScope()

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A `card` node as a facets panel, in the three views facets draws: the card, the full
 * inspector and the folded row. All three read one node; edits go through rhizome.
 */
export function CardDoc({ row, set }: { row: Row; set: SetValue }) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  // Keep a typed draft only until rhizome's value for that key changes (accepted, undone, redone),
  // or the selection moves to another node.
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

  const ctx = useMemo<CardContext>(
    () => ({
      set: (path, key, value, coalesce) => set(path, key, value, coalesce),
      setDraft: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    }),
    [set],
  )
  const selection = useMemo(() => ({ row, draft }), [row, draft])
  const view = useCallback(
    (v: "card" | "inspector" | "collapsed", title?: string) => (
      <PropertyPanel scopeKey="card" selection={selection} ctx={ctx} view={v} title={title} />
    ),
    [selection, ctx],
  )

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <DocHeader title="Card">
        A property card drawn by facets from a schema, bound to one rhizome node. The same node is
        shown three ways; edit in any of them.
      </DocHeader>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] items-start gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Card</h2>
          <Card className="gap-4 py-4">
            <CardContent className="px-4">{view("card", row.values?.name as string)}</CardContent>
          </Card>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</h2>
          <Card className="gap-4 py-4">
            <CardContent className="px-4">{view("inspector")}</CardContent>
          </Card>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collapsed</h2>
          <Card className="gap-4 py-4">
            <CardContent className="px-4">{view("collapsed")}</CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
