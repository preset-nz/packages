import {
  registerBuiltinRenderers,
  registerScope,
  type FieldDef,
  type PropertySchema,
  type Scope,
} from "@preset.nz/facets"

import { createStore, useStore } from "@preset.nz/app-kit"

import { nodeScope, type NodeAdapter } from "./bound"

/**
 * Three of Oblique's ops, as facets panels. The parameters are Oblique's own: names, labels,
 * ranges, steps, defaults and widgets from `sidecar/ops/{cmyk_halftone,film_stock,levels}.py`,
 * in declaration order, as `opParamsToSchema` lays them out (one untitled group, one row per
 * param). Oblique's spec carries no units; the ones shown (`px`, `°`) come from its description
 * strings. The one departure: the four screen angles are one `angles` row (a vector of
 * C, M, Y, K) over the four real keys `angle_c`..`angle_k`, where Oblique has four scalar rows.
 */

const num = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  extra: Partial<FieldDef> & { integer?: boolean; suffix?: string } = {},
): FieldDef =>
  ({ kind: "number", id, label, path: id, min, max, step, ...extra }) as FieldDef

const slider = (id: string, label: string, step: number, extra: Partial<FieldDef> = {}): FieldDef =>
  ({ kind: "slider", id, label, path: id, min: 0, max: 1, step, ...extra }) as FieldDef

const ink = (id: string, label: string): FieldDef => ({ kind: "color", id, label, path: id })

const CMYK_HALFTONE: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "cmyk_halftone",
      rows: [
        num("dot_size", "Dot size", 1, 200, 0.5, { suffix: "px", promote: ["card"] }),
        {
          kind: "vector",
          id: "angles",
          label: "Screen angles",
          path: "angles",
          promote: ["card"],
          components: ["C", "M", "Y", "K"].map((label) => ({ label, suffix: "°", min: 0, max: 90, step: 1 })),
        },
        ink("ink_c", "Cyan ink"),
        ink("ink_m", "Magenta ink"),
        ink("ink_y", "Yellow ink"),
        ink("ink_k", "Black ink"),
        num("misregistration", "Misregistration", 0, 8, 0.25, { suffix: "px", promote: ["card"] }),
        num("seed", "Seed", 0, 2 ** 31 - 1, 1, { integer: true }),
        {
          kind: "select",
          id: "mode",
          label: "Mode",
          path: "mode",
          options: ["paper", "over"].map((c) => ({ value: c, label: choiceLabel(c) })),
          promote: ["card"],
        },
        { kind: "checkbox", id: "white_is_alpha", label: "Paper is transparent", path: "white_is_alpha" },
        {
          kind: "checkbox",
          id: "spill",
          label: "Dots past edge",
          path: "spill",
          disabledWhen: { path: "white_is_alpha", equals: false },
        },
      ],
    },
  ],
}

const FILM_STOCK: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "film_stock",
      rows: [
        {
          kind: "select",
          id: "stock",
          label: "Stock",
          path: "stock",
          options: ["polaroid_600", "sx70", "cross_process", "bleach_bypass", "expired"].map((c) => ({ value: c, label: choiceLabel(c) })),
          promote: ["card"],
        },
        slider("amount", "Amount", 0.05, { promote: ["card"] }),
        slider("grain", "Grain", 0.05, { promote: ["card"] }),
        slider("vignette", "Vignette", 0.05, { promote: ["card"] }),
        num("seed", "Seed", 0, 2 ** 31 - 1, 1, { integer: true }),
      ],
    },
  ],
}

const LEVELS: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "levels",
      rows: [
        num("black", "Black point", 0, 255, 1, { promote: ["card"] }),
        num("white", "White point", 0, 255, 1, { promote: ["card"] }),
        num("gamma", "Gamma", 0.1, 5, 0.05, { promote: ["card"] }),
      ],
    },
  ],
}

/** An op node type: what the outline and the card call it, how its values cross, and its panel. */
export interface OpKind {
  type: string
  /** Oblique's `label`. */
  label: string
  schema: PropertySchema
  adapter: NodeAdapter
}

export const OPS: OpKind[] = [
  {
    type: "cmyk_halftone",
    label: "CMYK Halftone",
    schema: CMYK_HALFTONE,
    adapter: {
      colours: ["ink_c", "ink_m", "ink_y", "ink_k"],
      ints: ["seed"],
      groups: { angles: ["angle_c", "angle_m", "angle_y", "angle_k"] },
      streamed: new Set(["dot_size", "angles", "ink_c", "ink_m", "ink_y", "ink_k", "misregistration", "seed"]),
    },
  },
  {
    type: "film_stock",
    label: "Film stock",
    schema: FILM_STOCK,
    adapter: { ints: ["seed"], streamed: new Set(["amount", "grain", "vignette", "seed"]) },
  },
  {
    type: "levels",
    label: "Levels",
    schema: LEVELS,
    adapter: { streamed: new Set(["black", "white", "gamma"]) },
  },
]

export const opKind = (type: string) => OPS.find((o) => o.type === type)

/** One scope per op type, as Oblique registers `modifier:<opType>`. */
export const opScopeKey = (type: string) => `op:${type}`

let registered = false
/** Once, before the first panel. facets is `sideEffects: false`, so nothing registers on import. */
export function registerOpScopes() {
  if (registered) return
  registered = true
  registerBuiltinRenderers()
  for (const o of OPS) registerScope(opScopeKey(o.type), nodeScope(o.schema, o.adapter) as unknown as Scope)
}

// The alignment study's one setting. A view choice for the playground, not a document value:
// shared by the Ops document and the inspector, and not an undo step.
export type OpsLayout = "auto" | "column" | "stacked"
export const OPS_LAYOUTS: { value: OpsLayout; label: string; hint: string }[] = [
  { value: "column", label: "Label column", hint: "One shared label column; fields on one edge" },
  { value: "stacked", label: "Label on top", hint: "Every label above its field" },
  { value: "auto", label: "Facets as-is", hint: "Facets' default layout, for reference" },
]

const KEY = "ux-kit-playground.ops.layout.v2"
const initial = (): OpsLayout => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === "auto" || v === "column" || v === "stacked") return v
  } catch {
    // not remembered
  }
  return "column"
}
const layout = createStore<OpsLayout>(initial())
export const useOpsLayout = () => useStore(layout)
export const setOpsLayout = (v: OpsLayout) => {
  layout.set(v)
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // not remembered
  }
}

/** Oblique's choices are bare values ("bleach_bypass"); the panel shows them as words ("Bleach bypass"). */
function choiceLabel(value: string): string {
  if (value === "sx70") return "SX-70"
  const words = value.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
