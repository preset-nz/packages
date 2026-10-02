import { SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import { docInfo } from "../documents"
import type { History, Row } from "../rhizome"

function Prop({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate font-mono" title={typeof children === "string" ? children : undefined}>
        {children}
      </dd>
    </>
  )
}

const show = (v: unknown) => (typeof v === "string" ? v || "—" : JSON.stringify(v))

/** Properties of the selected document, then the tree's history (undo_labels, now, redo_labels). */
export function Inspector({ doc, history }: { doc: Row | null; history: History | null }) {
  const values = Object.entries(doc?.values ?? {})
  return (
    <>
      <SidePanelHeader>Inspector</SidePanelHeader>
      <SidePanelContent className="flex flex-col gap-6 p-3">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Properties</h3>
          {doc ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <Prop k="document">{docInfo(doc.type)?.label ?? doc.name}</Prop>
              <Prop k="path">{doc.path}</Prop>
              <Prop k="type">{doc.type}</Prop>
              <Prop k="id">{doc.id}</Prop>
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing selected.</p>
          )}
        </section>

        {doc && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Values</h3>
            {values.length === 0 ? (
              <p className="text-xs text-muted-foreground">This document holds no values.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {values.map(([k, v]) => (
                  <Prop key={k} k={k}>
                    {show(v)}
                  </Prop>
                ))}
              </dl>
            )}
          </section>
        )}

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
