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
            promote: "collapsed",
          },
          [
            { kind: "color", id: "fill", path: "fill", label: "Fill", promote: "card" },
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
          { kind: "textarea", id: "notes", path: "notes", label: "Notes", rows: 3, promote: "collapsed" },
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

// A synth operator, to show promotion: the same scope drawn as an
// inspector, a card and a collapsed line. Output starts closed, so its
// header shows its "collapsed" field.
const filterTypes = [
  { value: "lowpass", label: "Low-pass" },
  { value: "highpass", label: "High-pass" },
  { value: "bandpass", label: "Band-pass" },
]
const operator: Starter = {
  id: "operator",
  name: "Operator (promote)",
  schema: {
    version: 1,
    groups: [
      {
        id: "filter",
        title: "Filter",
        collapsible: true,
        rows: [
          { kind: "select", id: "type", path: "type", label: "Type", options: filterTypes, promote: "card" },
          { kind: "slider", id: "cutoff", path: "cutoff", label: "Cutoff", min: 20, max: 20000, step: 1, promote: "collapsed" },
          { kind: "slider", id: "resonance", path: "resonance", label: "Resonance", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        id: "output",
        title: "Output",
        collapsible: true,
        defaultCollapsed: true,
        rows: [
          { kind: "slider", id: "master", path: "master", label: "Master", min: 0, max: 1, step: 0.01, promote: "collapsed" },
          { kind: "slider", id: "pan", path: "pan", label: "Pan", min: -1, max: 1, step: 0.01, promote: "card" },
          { kind: "slider", id: "width", path: "width", label: "Width", min: 0, max: 1, step: 0.01 },
        ],
      },
    ],
  },
  values: { type: "lowpass", cutoff: 1200, resonance: 0.3, master: 0.8, pan: 0, width: 1 },
}

export const STARTERS: Starter[] = [empty, simple, operator, everything]
export const DEFAULT_STARTER = simple

export const pretty = (v: unknown) => JSON.stringify(v, null, 2)
