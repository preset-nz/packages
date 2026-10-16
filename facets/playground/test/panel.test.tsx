import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  type PropertyGroupDef,
  PropertyPanel,
  type PropertySchema,
  registerBuiltinRenderers,
  registerScope,
} from "../../src"

beforeAll(registerBuiltinRenderers)
afterEach(cleanup)

const text = (id: string, page?: string, more: Partial<PropertyGroupDef> = {}) => ({
  id,
  title: id,
  page,
  rows: [{ kind: "text", id, path: id, label: `Field ${id}` }],
  ...more,
})

const PAGED: PropertySchema = {
  version: 1,
  pages: [
    { id: "general", label: "General" },
    { id: "export", label: "Export" },
  ],
  groups: [
    text("a", "general", { collapsible: true }),
    text("b", "general", { advanced: true }),
    text("c", "export"),
    text("d", "export", { advanced: true }),
  ],
}

let n = 0
/** Registers the schema under a fresh key and draws it. */
function draw(
  schema: PropertySchema,
  props: Partial<React.ComponentProps<typeof PropertyPanel>> = {},
  changed?: string[],
) {
  const key = `test-${n++}`
  registerScope(key, { schema, read: () => ({}), changed: changed && (() => changed) })
  return render(<PropertyPanel scopeKey={key} selection={{}} ctx={null} {...props} />)
}

const shown = (label: string) => screen.queryByText(label) !== null
const advancedRow = () => screen.getByRole("button", { name: /^Advanced/ })

describe("pages", () => {
  it("draws a tab per page and only the open page's groups", () => {
    draw(PAGED)
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual(["General", "Export"])
    expect(shown("Field a")).toBe(true)
    expect(shown("Field c")).toBe(false)
  })

  it("switches page on a tab, and tells the host", () => {
    const onPageChange = vi.fn()
    draw(PAGED, { onPageChange })
    fireEvent.click(screen.getByRole("tab", { name: "Export" }))
    expect(onPageChange).toHaveBeenCalledWith("export")
    expect(shown("Field c")).toBe(true)
    expect(shown("Field a")).toBe(false)
  })

  it("follows a controlled page, falling back to the first for an unknown id", () => {
    const { rerender } = draw(PAGED, { page: "export" })
    expect(shown("Field c")).toBe(true)
    rerender(<PropertyPanel scopeKey={`test-${n - 1}`} selection={{}} ctx={null} page="gone" />)
    expect(shown("Field a")).toBe(true)
  })

  it("draws no tab row for one page", () => {
    draw({ ...PAGED, pages: [{ id: "only", label: "Only" }], groups: [text("a", "only")] })
    expect(screen.queryByRole("tablist")).toBeNull()
    expect(shown("Field a")).toBe(true)
  })

  it("keeps a group's fold across a tab switch", () => {
    draw(PAGED)
    const fold = screen.getByRole("button", { name: "a" })
    fireEvent.click(fold)
    expect(fold.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(screen.getByRole("tab", { name: "Export" }))
    fireEvent.click(screen.getByRole("tab", { name: "General" }))
    expect(screen.getByRole("button", { name: "a" }).getAttribute("aria-expanded")).toBe("false")
  })
})

describe("the Advanced row", () => {
  it("starts closed, controls a hidden body, and opens on a click", () => {
    const onAdvancedOpenChange = vi.fn()
    draw(PAGED, { onAdvancedOpenChange })
    const row = advancedRow()
    expect(row.getAttribute("aria-expanded")).toBe("false")
    const body = document.getElementById(row.getAttribute("aria-controls") ?? "")
    expect(body?.hidden).toBe(true)
    expect(within(body as HTMLElement).queryByText("Field b")).not.toBeNull()
    fireEvent.click(row)
    expect(row.getAttribute("aria-expanded")).toBe("true")
    expect(body?.hidden).toBe(false)
    expect(onAdvancedOpenChange).toHaveBeenLastCalledWith(["general"])
  })

  it("is per page, and controllable", () => {
    draw(PAGED, { page: "export", advancedOpen: ["export"] })
    expect(advancedRow().getAttribute("aria-expanded")).toBe("true")
  })

  it('works without pages, as page ""', () => {
    const onAdvancedOpenChange = vi.fn()
    draw(
      { version: 1, groups: [text("a"), text("b", undefined, { advanced: true })] },
      { onAdvancedOpenChange },
    )
    expect(screen.queryByRole("tablist")).toBeNull()
    fireEvent.click(advancedRow())
    expect(onAdvancedOpenChange).toHaveBeenLastCalledWith([""])
  })
})

describe("changed marks", () => {
  it("marks a tab that hides a changed field, not the open one", () => {
    draw(PAGED, {}, ["a", "c"])
    expect(screen.getByRole("tab", { name: "General" }).textContent).toBe("General")
    expect(screen.getByRole("tab", { name: "Export, changed" })).toBeTruthy()
  })

  it("marks a closed Advanced row or group that hides one, until it opens", () => {
    draw(PAGED, {}, ["a", "b"])
    expect(advancedRow().textContent).toBe("Advanced•, changed")
    fireEvent.click(advancedRow())
    expect(advancedRow().textContent).toBe("Advanced")
    const fold = screen.getByRole("button", { name: "a" })
    act(() => fold.click())
    expect(screen.getByRole("button", { name: "a, changed" })).toBeTruthy()
  })

  it("marks nothing without changed", () => {
    draw(PAGED)
    expect(screen.queryByText("changed", { exact: false })).toBeNull()
  })
})
