import { useRef, useState } from "react"
import { ColorField, SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import { colourToHex, hexToColour } from "../colour"
import type { History, Row } from "../rhizome"

const PRESETS = ["#f8f5e7ff", "#efe7d3ff", "#ffffffff", "#cccccc", "#e5484d", "#3e63dd", "#000000"]

function Prop({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate font-mono">{children}</dd>
    </>
  )
}

/** Properties of the selected note, then the tree's history (undo_labels, now, redo_labels). */
export function Inspector({
  note,
  history,
  onSetColour,
}: {
  note: Row | null
  history: History | null
  onSetColour: (path: string, colour: [number, number, number, number]) => void
}) {
  const hex = colourToHex(note?.values?.colour)
  // A native picker session is one undo step: hold the value until it closes.
  const picking = useRef(false)
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (value: string | null) => {
    const c = value && hexToColour(value)
    if (note && c && value !== hex) onSetColour(note.path, c)
  }

  return (
    <>
      <SidePanelHeader>Inspector</SidePanelHeader>
      <SidePanelContent className="flex flex-col gap-6 p-3">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Properties</h3>
          {note ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <Prop k="name">{note.name}</Prop>
                <Prop k="path">{note.path}</Prop>
                <Prop k="type">{note.type}</Prop>
                <Prop k="id">{note.id}</Prop>
              </dl>
              <ColorField
                label="Colour"
                alpha
                presets={PRESETS}
                value={draft ?? hex}
                onPickStart={() => {
                  picking.current = true
                }}
                onPickEnd={() => {
                  picking.current = false
                  commit(draft)
                  setDraft(null)
                }}
                onChange={(v) => (picking.current ? setDraft(v) : commit(v))}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing selected.</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</h3>
          {history && (
            <ol className="flex flex-col gap-0.5 font-mono text-xs">
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
      </SidePanelContent>
    </>
  )
}
