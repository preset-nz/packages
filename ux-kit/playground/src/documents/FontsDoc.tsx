import { useEffect, useRef, useState } from "react"

import { selectFont, useFontSamples, useSelection } from "../selection"
import { ROLES, SIZES, WEIGHTS, type FontRole } from "./fonts"
import { DocHeader } from "./Header"
import { Selectable } from "./Selectable"

function Specimen({ role, token, cls, sample: defaultSample }: FontRole) {
  const ref = useRef<HTMLElement>(null)
  const [stack, setStack] = useState("")
  const selection = useSelection()
  const sample = useFontSamples()[role] || defaultSample
  // What the browser resolves for this role, so the card shows the real stack.
  useEffect(() => {
    if (ref.current) setStack(getComputedStyle(ref.current).fontFamily)
  }, [])

  return (
    <Selectable
      selected={selection.kind === "font" && selection.role === role}
      onSelect={() => selectFont(role)}
      className="border border-border bg-card p-4"
    >
      <article ref={ref} className={cls}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className="text-xl font-semibold">{role}</h2>
          <span className="font-mono text-xs text-muted-foreground">{token}</span>
        </header>
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{stack}</p>

        <div className="mt-4 text-6xl leading-none" aria-hidden>
          Aa
        </div>

        <h3 className="mb-2 mt-6 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Weights
        </h3>
        <ul className="flex flex-col gap-1">
          {WEIGHTS.map((w) => (
            <li key={w.w} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 font-sans text-xs text-muted-foreground">
                {w.w} {w.name}
              </span>
              <span className={`${w.cls} truncate text-lg`}>{sample}</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 mt-6 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sizes
        </h3>
        <ul className="flex flex-col gap-1">
          {SIZES.map((s) => (
            <li key={s.cls} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {s.cls} {s.px}
              </span>
              <span className={`${s.cls} truncate`}>{sample}</span>
            </li>
          ))}
        </ul>
      </article>
    </Selectable>
  )
}

/** One specimen per font role: the family stack, weights and the type scale. Select a role. */
export function FontsDoc() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <DocHeader title="Fonts">
        Three roles: headings, body text and code. Sizes are the type scale; weights are the ones the
        kit loads. Select a role to type your own sample.
      </DocHeader>
      <div className="flex flex-col gap-4 p-1">
        {ROLES.map((r) => (
          <Specimen key={r.role} {...r} />
        ))}
      </div>
    </div>
  )
}
