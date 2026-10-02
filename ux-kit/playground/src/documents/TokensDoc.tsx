import { useMemo } from "react"
// The kit's own stylesheet as text: the document is read from the same variables the app uses.
import css from "@preset.nz/ux-kit/index.css?raw"

import { DocHeader } from "./Header"

type Vars = Map<string, string>

/** The `--name: value` declarations of the first rule whose selector matches `selector`. */
function declarations(selector: RegExp): Vars {
  const body = selector.exec(css)?.[1] ?? ""
  const vars: Vars = new Map()
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim())
  return vars
}

const isColour = (v: string) => /^(oklch|oklab|hsl|rgb|#)/.test(v)

function group(name: string) {
  if (name.startsWith("sidebar")) return "Sidebar"
  if (name.startsWith("chart")) return "Chart"
  return "Surface and text"
}

/** Every colour token in index.css, as a card: swatches in light and dark, name, values. */
export function TokensDoc() {
  const groups = useMemo(() => {
    const light = declarations(/^:root\s*\{([^}]*)\}/m)
    const dark = declarations(/^\.dark\s*\{([^}]*)\}/m)
    const out = new Map<string, { name: string; light: string; dark: string }[]>()
    for (const [key, value] of light) {
      if (!isColour(value)) continue
      const g = group(key.slice(2))
      out.set(g, [...(out.get(g) ?? []), { name: key, light: value, dark: dark.get(key) ?? value }])
    }
    return [...out]
  }, [])

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <DocHeader title="Tokens">
        The kit&apos;s colour variables, read from <span className="font-mono">index.css</span>. Each
        card shows the light value on the left and the dark value on the right.
      </DocHeader>
      {groups.map(([title, tokens]) => (
        <section key={title} className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {tokens.map((t) => (
              <article key={t.name} className="overflow-hidden rounded-md border border-border bg-card">
                <div className="flex h-16" aria-hidden>
                  <div className="flex-1" style={{ background: t.light }} />
                  <div className="flex-1" style={{ background: t.dark }} />
                </div>
                <div className="flex flex-col gap-1 p-2 text-xs">
                  <div className="font-mono font-medium">{t.name}</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-muted-foreground">
                    <dt>light</dt>
                    <dd className="truncate font-mono text-foreground" title={t.light}>{t.light}</dd>
                    <dt>dark</dt>
                    <dd className="truncate font-mono text-foreground" title={t.dark}>{t.dark}</dd>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
