import { useMemo } from "react"

import { selectToken, useSelection } from "../selection"
import { DOC_PAGE, DocHeader } from "./Header"
import { Selectable } from "./Selectable"
import { TOKENS } from "./tokens"

/** Every colour token in index.css, as a card: swatches in light and dark, name, values. Select one. */
export function TokensDoc() {
  const selection = useSelection()
  const groups = useMemo(() => {
    const out = new Map<string, typeof TOKENS>()
    for (const t of TOKENS) out.set(t.group, [...(out.get(t.group) ?? []), t])
    return [...out]
  }, [])

  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Tokens">
        The kit&apos;s colour variables, read from <span className="font-mono">index.css</span>.
        Each card shows the light value on the left and the dark value on the right. Select a card
        to inspect it.
      </DocHeader>
      {groups.map(([title, tokens]) => (
        <section key={title} className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 p-1">
            {tokens.map((t) => (
              <Selectable
                key={t.name}
                as="article"
                selected={selection.kind === "token" && selection.name === t.name}
                onSelect={() => selectToken(t.name)}
                className="overflow-hidden border border-border bg-card"
              >
                <div className="flex h-16" aria-hidden>
                  <div className="flex-1" style={{ background: t.light }} />
                  <div className="flex-1" style={{ background: t.dark }} />
                </div>
                <div className="flex flex-col gap-1 p-2 text-xs">
                  <div className="font-mono font-medium">{t.name}</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-muted-foreground">
                    <dt>light</dt>
                    <dd className="truncate font-mono text-foreground" title={t.light}>
                      {t.light}
                    </dd>
                    <dt>dark</dt>
                    <dd className="truncate font-mono text-foreground" title={t.dark}>
                      {t.dark}
                    </dd>
                  </dl>
                </div>
              </Selectable>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
