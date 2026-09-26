import type { PropertySchema } from "../../src"

export interface Starter {
  id: string
  name: string
  schema: PropertySchema
  values: Record<string, unknown>
}

const blendOptions = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
]

const empty: Starter = {
  id: "empty",
  name: "Empty",
  schema: { version: 1, groups: [{ id: "group", title: "Group", collapsible: true, rows: [] }] },
  values: {},
}

// Enough to show a group, a paired row and a disabledWhen.
const simple: Starter = {
  id: "simple",
  name: "Simple",
  schema: {
    version: 1,
    groups: [
      {
        id: "layer",
        title: "Layer",
        collapsible: true,
        rows: [
          { kind: "text", id: "name", path: "name", label: "Name" },
          { kind: "checkbox", id: "visible", path: "visible", label: "Visible" },
          {
            kind: "slider",
            id: "opacity",
            path: "opacity",
            label: "Opacity",
            min: 0,
            max: 1,
            step: 0.01,
            disabledWhen: { path: "visible", equals: false },
          },
          [
            { kind: "color", id: "fill", path: "fill", label: "Fill" },
            { kind: "select", id: "blend", path: "blend", label: "Blend", options: blendOptions },
          ],
        ],
      },
    ],
  },
  values: { name: "Coastline", visible: true, opacity: 0.8, fill: "#2b7c76", blend: "normal" },
}

// Every built-in kind, both custom kinds, each disabledWhen operator, and
// every group option.
const everything: Starter = {
  id: "everything",
  name: "One of everything",
  schema: {
    version: 1,
    groups: [
      {
        id: "layer",
        title: "Layer",
        description: "A map layer.",
        collapsible: true,
        rows: [
          [
            { kind: "text", id: "name", path: "name", label: "Name", placeholder: "Untitled" },
            { kind: "select", id: "blend", path: "blend", label: "Blend", options: blendOptions },
          ],
          { kind: "checkbox", id: "visible", path: "visible", label: "Visible" },
          {
            kind: "slider",
            id: "opacity",
            path: "opacity",
            label: "Opacity",
            min: 0,
            max: 1,
            step: 0.01,
            disabledWhen: { path: "visible", equals: false },
          },
          {
            kind: "label",
            id: "blendHint",
            label: "Tint only applies to Multiply and Screen.",
            disabledWhen: { path: "blend", equals: "normal" },
          },
          {
            kind: "color",
            id: "tint",
            path: "tint",
            label: "Tint",
            disabledWhen: { path: "blend", notIn: ["multiply", "screen"] },
          },
        ],
      },
      {
        id: "transform",
        title: "Transform",
        collapsible: true,
        rows: [
          {
            kind: "vector",
            id: "position",
            path: "position",
            label: "Position",
            components: [
              { label: "x", suffix: "px" },
              { label: "y", suffix: "px" },
            ],
            integer: true,
          },
          {
            kind: "vector",
            id: "lch",
            path: "lch",
            label: "Base colour (LCh)",
            components: [
              { label: "L", min: 0, max: 100 },
              { label: "C", min: 0, max: 150 },
              { label: "h", suffix: "°", min: 0, max: 360 },
            ],
            precision: 1,
          },
          { kind: "separator", id: "sep1" },
          [
            { kind: "number", id: "width", path: "width", label: "Width", min: 1, step: 1 },
            { kind: "number", id: "height", path: "height", label: "Height", min: 1, step: 1 },
          ],
        ],
      },
      {
        id: "notes",
        title: "Notes",
        description: "Starts folded: defaultCollapsed.",
        collapsible: true,
        defaultCollapsed: true,
        rows: [
          { kind: "textarea", id: "notes", path: "notes", label: "Notes", rows: 3 },
          { kind: "file", id: "source", path: "source", label: "Source" },
          { kind: "label", id: "custom", label: "Custom kinds, registered by this playground:" },
          [
            {
              kind: "swatches",
              id: "palette",
              path: "palette",
              label: "Palette",
              colours: ["#111010", "#2b7c76", "#d4ecea", "#c2410c", "#f2ede6"],
            },
            { kind: "rating", id: "rating", path: "rating", label: "Rating", max: 5 },
          ],
        ],
      },
    ],
  },
  values: {
    name: "Coastline",
    blend: "multiply",
    visible: true,
    opacity: 0.8,
    tint: "#2b7c76",
    position: [120, 48],
    lch: [62.4, 38.1, 188],
    width: 1024,
    height: 768,
    notes: "Traced from the 1:50k topo.",
    source: { name: "harbour.jpg" },
    palette: "#2b7c76",
    rating: 4,
  },
}

export const STARTERS: Starter[] = [empty, simple, everything]
export const DEFAULT_STARTER = simple

export const pretty = (v: unknown) => JSON.stringify(v, null, 2)
