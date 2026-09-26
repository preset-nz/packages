import type { FieldDef } from "../../src"

/**
 * One palette entry per field kind: what the hover card says, and what a click
 * appends. `make(n)` gets a counter so ids and paths stay unique.
 */
export interface KindEntry {
  kind: string
  blurb: string
  props: Array<[name: string, doc: string]>
  custom?: boolean
  make: (n: number) => { field: FieldDef; value: unknown }
}

const id = (kind: string, n: number) => `${kind}${n}`

export const CATALOGUE: KindEntry[] = [
  {
    kind: "text",
    blurb: "A single line of text.",
    props: [["placeholder", "shown while empty"]],
    make: (n) => ({
      field: { kind: "text", id: id("text", n), path: id("text", n), label: "Name" },
      value: "Untitled",
    }),
  },
  {
    kind: "textarea",
    blurb: "Several lines of text.",
    props: [
      ["placeholder", "shown while empty"],
      ["rows", "visible lines, default 3"],
    ],
    make: (n) => ({
      field: { kind: "textarea", id: id("notes", n), path: id("notes", n), label: "Notes", rows: 3 },
      value: "",
    }),
  },
  {
    kind: "number",
    blurb: "A number typed into a box.",
    props: [
      ["min", "lower bound"],
      ["max", "upper bound"],
      ["step", "increment, default 1"],
    ],
    make: (n) => ({
      field: { kind: "number", id: id("number", n), path: id("number", n), label: "Width", min: 0, step: 1 },
      value: 1024,
    }),
  },
  {
    kind: "slider",
    blurb: "A number dragged along a range.",
    props: [
      ["min", "lower bound"],
      ["max", "upper bound"],
      ["step", "increment, default 1"],
    ],
    make: (n) => ({
      field: { kind: "slider", id: id("slider", n), path: id("slider", n), label: "Opacity", min: 0, max: 1, step: 0.01 },
      value: 0.6,
    }),
  },
  {
    kind: "select",
    blurb: "One choice from a fixed list. The value is the option's `value`.",
    props: [
      ["options", "[{ value, label }]"],
      ["optionsProvider", "a function in code, so not available here"],
    ],
    make: (n) => ({
      field: {
        kind: "select",
        id: id("select", n),
        path: id("select", n),
        label: "Blend",
        options: [
          { value: "normal", label: "Normal" },
          { value: "multiply", label: "Multiply" },
          { value: "screen", label: "Screen" },
        ],
      },
      value: "normal",
    }),
  },
  {
    kind: "color",
    blurb: "A colour as a hex string, with a swatch.",
    props: [["presets", "hex strings (declared, not yet drawn)"]],
    make: (n) => ({
      field: { kind: "color", id: id("colour", n), path: id("colour", n), label: "Colour" },
      value: "#2b7c76",
    }),
  },
  {
    kind: "checkbox",
    blurb: "On or off. A good driver for `disabledWhen` on other fields.",
    props: [],
    make: (n) => ({
      field: { kind: "checkbox", id: id("checkbox", n), path: id("checkbox", n), label: "Enabled" },
      value: true,
    }),
  },
  {
    kind: "file",
    blurb: "Shows a file's name. Picking a file is the host's job, so this one is always read-only.",
    props: [
      ["accept", "file types, as on <input>"],
      ["helperText", "a hint (declared, not yet drawn)"],
    ],
    make: (n) => ({
      field: { kind: "file", id: id("file", n), path: id("file", n), label: "Source" },
      value: { name: "harbour.jpg" },
    }),
  },
  {
    kind: "vector",
    blurb: "Several numbers that belong together, in one row: position, size, RGB, LCh.",
    props: [
      ["components", "[{ label, suffix, min, max, step }], one per slot"],
      ["integer", "truncate to whole numbers"],
      ["precision", "decimals when read-only"],
    ],
    make: (n) => ({
      field: {
        kind: "vector",
        id: id("vector", n),
        path: id("vector", n),
        label: "Position",
        components: [{ label: "x" }, { label: "y" }, { label: "z" }],
      },
      value: [0, 0, 0],
    }),
  },
  {
    kind: "swatches",
    custom: true,
    blurb: "A custom kind, registered by this playground. Picks one colour from a strip.",
    props: [["colours", "hex strings to choose from"]],
    make: (n) => ({
      field: {
        kind: "swatches",
        id: id("swatches", n),
        path: id("swatches", n),
        label: "Palette",
        colours: ["#111010", "#2b7c76", "#d4ecea", "#c2410c", "#f2ede6"],
      },
      value: "#2b7c76",
    }),
  },
  {
    kind: "rating",
    custom: true,
    blurb: "A custom kind, registered by this playground. A whole number out of `max`.",
    props: [["max", "number of steps, default 5"]],
    make: (n) => ({
      field: { kind: "rating", id: id("rating", n), path: id("rating", n), label: "Rating", max: 5 },
      value: 3,
    }),
  },
]

export const KNOWN_KINDS = new Set(CATALOGUE.map((e) => e.kind))

export interface Doc {
  kind: string
  blurb: string
  props: Array<[name: string, doc: string]>
  example?: string
}

export const DISABLED_WHEN_DOC: Doc = {
  kind: "disabledWhen",
  blurb:
    "Greys a field out depending on another field's value. Click to make the last field depend on the nearest checkbox (one is added if there isn't one).",
  props: [
    ["path", "the field to watch"],
    ["equals", "disabled when it equals this"],
    ["notEquals", "disabled unless it equals this"],
    ["in", "disabled when it's one of a list"],
    ["notIn", "disabled unless it's one of a list"],
  ],
  example: `"disabledWhen": {
  "path": "blend",
  "in": ["multiply", "screen"]
}`,
}
