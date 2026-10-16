import { describe, expect, it } from "vitest"
import {
  type PropertyGroupDef,
  type PropertySchema,
  registerScope,
  schemaProblems,
  unregisterScope,
} from "../../src"

const group = (id: string, more: Partial<PropertyGroupDef> = {}): PropertyGroupDef => ({
  id,
  rows: [],
  ...more,
})
const paged = (groups: PropertyGroupDef[]): PropertySchema => ({
  version: 1,
  pages: [
    { id: "general", label: "General" },
    { id: "export", label: "Export" },
  ],
  groups,
})

describe("schemaProblems", () => {
  it("passes a schema without pages, as before", () => {
    expect(schemaProblems({ version: 1, groups: [] })).toEqual([])
    expect(schemaProblems({ version: 1, groups: [group("a"), group("b")] })).toEqual([])
  })

  it("passes advanced groups beside a plain one, with or without pages", () => {
    expect(
      schemaProblems({ version: 1, groups: [group("a"), group("b", { advanced: true })] }),
    ).toEqual([])
    const ok = paged([
      group("a", { page: "general" }),
      group("b", { page: "general", advanced: true }),
      group("c", { page: "export" }),
    ])
    expect(schemaProblems(ok)).toEqual([])
  })

  it("rejects a page named without pages", () => {
    expect(schemaProblems({ version: 1, groups: [group("a", { page: "x" })] })).toEqual([
      'groups[0] ("a"): names page "x", but there are no pages',
    ])
  })

  it("rejects groups that are all advanced", () => {
    expect(schemaProblems({ version: 1, groups: [group("a", { advanced: true })] })).toHaveLength(1)
    const bad = paged([
      group("a", { page: "general" }),
      group("b", { page: "export", advanced: true }),
    ])
    expect(schemaProblems(bad)).toEqual([
      'page "export" has only advanced groups: give it one that isn\'t',
    ])
  })

  it("rejects a group without a page, or with an undeclared one", () => {
    const bad = paged([group("a"), group("b", { page: "general" }), group("c", { page: "nope" })])
    expect(schemaProblems(bad)).toEqual([
      'groups[0] ("a"): names no page',
      'groups[2] ("c"): page "nope" is not declared',
      'page "export" has no groups',
    ])
  })

  it("rejects empty pages, duplicate ids and empty ids", () => {
    expect(schemaProblems({ version: 1, pages: [], groups: [] })).toEqual([
      "pages is empty: omit it for one page",
    ])
    const twice: PropertySchema = {
      version: 1,
      pages: [
        { id: "a", label: "A" },
        { id: "a", label: "Again" },
        { id: "", label: "Blank" },
      ],
      groups: [group("g", { page: "a" })],
    }
    expect(schemaProblems(twice)).toEqual(['pages: "a" is declared twice', "pages: an id is empty"])
  })
})

describe("registerScope", () => {
  it("throws on a schema with problems, naming the scope", () => {
    const schema = paged([group("a", { page: "general" })])
    expect(() => registerScope("bad", { schema, read: () => ({}) })).toThrow(
      /scope "bad": page "export" has no groups/,
    )
  })

  it("registers a sound paged schema", () => {
    const schema = paged([group("a", { page: "general" }), group("b", { page: "export" })])
    expect(() => registerScope("good", { schema, read: () => ({}) })).not.toThrow()
    unregisterScope("good")
  })
})
