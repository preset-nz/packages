import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, describe, expect, it } from "vitest"
import { PropertyPanel, registerBuiltinRenderers, registerScope } from "../../src"
import { registerCustomKinds } from "../src/custom-kinds"
import { STARTERS } from "../src/defaults"

// Every unpaged starter, drawn in each view. The snapshots were taken before
// pages existed: a schema without pages must still draw exactly this.
beforeAll(() => {
  registerBuiltinRenderers()
  registerCustomKinds()
})

describe.each(STARTERS.filter((s) => !s.schema.pages))("starter $id", ({ id, schema, values }) => {
  it.each(["inspector", "card", "collapsed"] as const)("draws the same %s", (view) => {
    registerScope(id, { schema, read: (v: Record<string, unknown>) => v, write: () => {} })
    const html = renderToStaticMarkup(
      <PropertyPanel scopeKey={id} selection={values} ctx={null} view={view} />,
    )
    expect(html).toMatchSnapshot()
  })
})
