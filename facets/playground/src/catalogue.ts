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
  /** Display-only kinds sit under Layout in the palette. */
  layout?: boolean
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
    blurb:
      "A colour as a hex string. Built in as a swatch and a hex box; this playground overrides the renderer with a picker, as a host app would.",
    props: [["presets", "hex strings (declared, not yet drawn)"]],
    make: (n) => ({
      field: { kind: "color", id: id("colour", n), path: id("colour", n), label: "Colour" },
      value: "#2b7c76",
    }),
  },
  {
    kind: "checkbox",
    blurb: "On or off. Often the value a `disabledWhen` watches.",
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

CATALOGUE.push(
  {
    kind: "separator",
    layout: true,
    blurb: "A horizontal rule between rows. It has no path and holds no value.",
    props: [],
    make: (n) => ({ field: { kind: "separator", id: id("sep", n) }, value: undefined }),
  },
  {
    kind: "label",
    layout: true,
    blurb:
      "Static text: a hint, a note, a sub-heading. It has no path. Give it a disabledWhen to grey it out along with the field it describes.",
    props: [["label", "the text"]],
    make: (n) => ({
      field: { kind: "label", id: id("note", n), label: "A note about the fields below." },
      value: undefined,
    }),
  },
)

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
    "Greys a field out depending on another field's value. A click makes the field at the caret (or the last field) depend on the nearest checkbox above it, adding one if there is none.",
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

export const PROMOTE_DOC: Doc = {
  kind: "promote",
  blurb:
    "Shows a field outside the inspector, like a parm promoted to a Houdini asset's interface. A click promotes the field at the caret (or the last field); clicking the same level again removes it.",
  props: [
    ["collapsed", "in a closed group's header, a folded scope and the card"],
    ["card", "on the card only"],
  ],
  example: `"promote": "collapsed"`,
}

export const GROUP_DOC: Doc = {
  kind: "group",
  blurb: "A new group after the one at the caret, or at the end.",
  props: [
    ["title", "the heading; omit for none"],
    ["description", "a line under the title"],
    ["collapsible", "fold under the title"],
    ["defaultCollapsed", "start folded"],
    ["rows", "fields, or [field, field] for a row of two"],
  ],
  example: `{
  "id": "group2",
  "title": "Group 2",
  "collapsible": true,
  "rows": []
}`,
}
