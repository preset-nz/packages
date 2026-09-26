import type { PropertySchema } from "../../src"

// Small on purpose: enough to show a group, a paired row and a disabledWhen.
// The palette adds the rest.
export const DEFAULT_SCHEMA: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "layer",
      title: "Layer",
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
          {
            kind: "select",
            id: "blend",
            path: "blend",
            label: "Blend",
            options: [
              { value: "normal", label: "Normal" },
              { value: "multiply", label: "Multiply" },
              { value: "screen", label: "Screen" },
            ],
          },
        ],
      ],
    },
  ],
}

export const DEFAULT_VALUES: Record<string, unknown> = {
  name: "Coastline",
  visible: true,
  opacity: 0.8,
  fill: "#2b7c76",
  blend: "normal",
}

export const pretty = (v: unknown) => JSON.stringify(v, null, 2)
