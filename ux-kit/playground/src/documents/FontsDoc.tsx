import { useEffect, useRef, useState } from "react"

import { DocHeader } from "./Header"

// Literal class names, so Tailwind sees them. Sizes are Tailwind's type scale.
const SIZES = [
  { cls: "text-xs", px: 12 },
  { cls: "text-sm", px: 14 },
  { cls: "text-base", px: 16 },
  { cls: "text-lg", px: 18 },
  { cls: "text-xl", px: 20 },
  { cls: "text-2xl", px: 24 },
  { cls: "text-3xl", px: 30 },
  { cls: "text-4xl", px: 36 },
] as const

const WEIGHTS = [
  { cls: "font-normal", w: 400, name: "Regular" },
  { cls: "font-medium", w: 500, name: "Medium" },
  { cls: "font-semibold", w: 600, name: "Semibold" },
  { cls: "font-bold", w: 700, name: "Bold" },
] as const

const ROLES = [
  { role: "Heading", token: "--font-heading", cls: "font-heading", sample: "Layers and masks" },
  { role: "Body", token: "--font-sans", cls: "font-sans", sample: "The quick brown fox jumps over the lazy dog" },
  { role: "Mono", token: "--font-mono", cls: "font-mono", sample: "const opacity = 0.75 // 0123456789" },
] as const

function Specimen({ role, token, cls, sample }: (typeof ROLES)[number]) {
  const ref = useRef<HTMLElement>(null)
  const [stack, setStack] = useState("")
  // What the browser resolves for this role, so the card shows the real stack.
  useEffect(() => {
    if (ref.current) setStack(getComputedStyle(ref.current).fontFamily)
  }, [])

  return (
    <article ref={ref} className={`${cls} rounded-md border border-border bg-card p-4`}>
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
  )
}

/** One specimen per font role: the family stack, weights and the type scale. */
export function FontsDoc() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <DocHeader title="Fonts">
        Three roles: headings, body text and code. Sizes are the type scale; weights are the ones the
        kit loads.
      </DocHeader>
      <div className="flex flex-col gap-4">
        {ROLES.map((r) => (
          <Specimen key={r.role} {...r} />
        ))}
      </div>
    </div>
  )
}
