import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, describe, expect, it } from "vitest"
import {
  type LabelLayout,
  type PanelView,
  PropertyPanel,
  type PropertySchema,
  registerBuiltinRenderers,
  registerScope,
} from "../../src"

// A field's help: drawn under it in the inspector, left out of the card and
// the collapsed view, and a file field's deprecated helperText stands in.
beforeAll(() => {
  registerBuiltinRenderers()
})

const schema: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "export",
      title: "Export",
      rows: [
        {
          kind: "checkbox",
          id: "reveal",
          label: "Show the file",
          path: "reveal",
          help: "Opens Finder on the exported file.",
          promote: ["card", "collapsed"],
        },
        { kind: "file", id: "logo", label: "Logo", path: "logo", helperText: "A PNG or SVG." },
        { kind: "number", id: "scale", label: "Scale", path: "scale" },
      ],
    },
  ],
}

function draw(view: PanelView, labelLayout?: LabelLayout) {
  registerScope("help", { schema, read: (v: Record<string, unknown>) => v, write: () => {} })
  return renderToStaticMarkup(
    <PropertyPanel
      scopeKey="help"
      selection={{ reveal: false, logo: "", scale: 1 }}
      ctx={null}
      view={view}
      labelLayout={labelLayout}
    />,
  )
}

describe("field help", () => {
  it.each(["column", "auto", "stacked"] as const)("is drawn in the inspector (%s)", (layout) => {
    const html = draw("inspector", layout)
    expect(html).toContain("Opens Finder on the exported file.")
  })

  it("stands in for a file field's helperText", () => {
    expect(draw("inspector")).toContain("A PNG or SVG.")
  })

  it("adds nothing to a field without it", () => {
    const html = draw("inspector")
    // Two fields with help (one through helperText), so two help lines, none for Scale.
    expect(html.split("leading-snug").length - 1).toBe(2)
  })

  it.each(["card", "collapsed"] as const)("is left out of the %s view", (view) => {
    const html = draw(view)
    expect(html).toContain("Show the file")
    expect(html).not.toContain("Opens Finder on the exported file.")
  })
})
