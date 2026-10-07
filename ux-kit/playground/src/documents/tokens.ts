// The kit's own stylesheet as text: the document is read from the same variables the app uses.
import css from "@preset.nz/ux-kit/index.css?raw"

type Vars = Map<string, string>

/** The `--name: value` declarations of the first rule whose selector matches `selector`. */
function declarations(selector: RegExp): Vars {
  const body = selector.exec(css)?.[1] ?? ""
  const vars: Vars = new Map()
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim())
  return vars
}

const isColour = (v: string) => /^(oklch|oklab|hsl|rgb|#)/.test(v)

export interface Token {
  /** The CSS variable, `--background`. */
  name: string
  light: string
  dark: string
  group: string
  /** Tailwind's colour name for it, `background` in `bg-background`, when the theme maps one. */
  utility: string | null
}

function group(name: string) {
  if (name.startsWith("sidebar")) return "Sidebar"
  if (name.startsWith("chart")) return "Chart"
  return "Surface and text"
}

/** Every colour token in index.css, in file order. */
function readTokens(): Token[] {
  const light = declarations(/^:root\s*\{([^}]*)\}/m)
  const dark = declarations(/^\.dark\s*\{([^}]*)\}/m)
  // `--color-card: var(--card);` in the theme block is what makes `bg-card` exist.
  const utilities = new Map<string, string>()
  for (const m of css.matchAll(/--color-([\w-]+)\s*:\s*var\((--[\w-]+)\)/g))
    utilities.set(m[2], m[1])
  const out: Token[] = []
  for (const [name, value] of light) {
    if (!isColour(value)) continue
    out.push({
      name,
      light: value,
      dark: dark.get(name) ?? value,
      group: group(name.slice(2)),
      utility: utilities.get(name) ?? null,
    })
  }
  return out
}

export const TOKENS: Token[] = readTokens()
