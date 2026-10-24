// The file drop hookup across packages: app-kit's hit-testing (Tauri-free half), the DOM contract
// shared with ux-kit, and the facets `file` field committing a drop like a pick. app-kit and
// ux-kit have no TS test runner of their own, so their pure parts are tested here.
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PATH_DROP_TARGET_ATTRIBUTE as APP_KIT_ATTRIBUTE,
  PATH_DROP_EVENT as APP_KIT_EVENT,
  createDropHandler,
  PATH_FIELD_SELECTOR,
  pathFieldAt,
  positionScale,
  toCssPoint,
} from "../../../app-kit/src-ts/drop-target"
import {
  PATH_DROP_EVENT,
  PATH_DROP_TARGET_ATTRIBUTE,
  PathField,
} from "../../../ux-kit/src/components/path-field"

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

/** jsdom has no layout: elementFromPoint answers from a table of "x,y" to element. */
function stubHitTest(at: Record<string, Element | null>) {
  document.elementFromPoint = (x: number, y: number) => at[`${x},${y}`] ?? null
}

function fieldDom() {
  document.body.innerHTML = `<div data-slot="path-field" id="f"><div><input id="i"></div></div><div id="other"></div>`
  return {
    field: document.getElementById("f") as HTMLElement,
    input: document.getElementById("i") as HTMLElement,
    other: document.getElementById("other") as HTMLElement,
  }
}

describe("contract strings", () => {
  it("app-kit and ux-kit agree", () => {
    expect(APP_KIT_EVENT).toBe(PATH_DROP_EVENT)
    expect(APP_KIT_ATTRIBUTE).toBe(PATH_DROP_TARGET_ATTRIBUTE)
    expect(PATH_FIELD_SELECTOR).toBe('[data-slot="path-field"]')
  })
})

describe("positionScale", () => {
  it("divides by the pixel ratio on Windows only", () => {
    expect(positionScale("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130", 1.5)).toBe(1.5)
    expect(positionScale("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit", 2)).toBe(1)
    expect(positionScale("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit", 2)).toBe(1)
    expect(positionScale("Windows", 0)).toBe(1)
  })
})

describe("toCssPoint", () => {
  it("divides by the scale", () => {
    expect(toCssPoint({ x: 400, y: 300 }, 2)).toEqual({ x: 200, y: 150 })
    expect(toCssPoint({ x: 300, y: 150 }, 1.5)).toEqual({ x: 200, y: 100 })
    expect(toCssPoint({ x: 10, y: 20 }, 1)).toEqual({ x: 10, y: 20 })
  })
  it("treats a nonsense scale as 1", () => {
    expect(toCssPoint({ x: 10, y: 20 }, 0)).toEqual({ x: 10, y: 20 })
  })
})

describe("pathFieldAt", () => {
  it("walks up from the element under the point to the field", () => {
    const { field, input, other } = fieldDom()
    stubHitTest({ "5,5": input, "9,9": other })
    expect(pathFieldAt(document, 5, 5)).toBe(field)
    expect(pathFieldAt(document, 9, 9)).toBeNull()
    expect(pathFieldAt(document, 0, 0)).toBeNull()
  })
})

describe("createDropHandler", () => {
  it("marks the field while a drag is over it and clears on leave", () => {
    const { field, input, other } = fieldDom()
    stubHitTest({ "10,10": input, "30,30": other })
    const handle = createDropHandler(document, () => 2)
    handle({ type: "enter", paths: ["/a.png"], position: { x: 20, y: 20 } })
    expect(field.hasAttribute("data-drop-target")).toBe(true)
    handle({ type: "over", position: { x: 60, y: 60 } })
    expect(field.hasAttribute("data-drop-target")).toBe(false)
    handle({ type: "over", position: { x: 20, y: 20 } })
    expect(field.hasAttribute("data-drop-target")).toBe(true)
    handle({ type: "leave" })
    expect(field.hasAttribute("data-drop-target")).toBe(false)
  })

  it("dispatches path-drop with the first path and clears the mark", () => {
    const { field, input } = fieldDom()
    stubHitTest({ "10,10": input })
    const seen: string[] = []
    field.addEventListener(PATH_DROP_EVENT, (e) => seen.push((e as CustomEvent).detail.path))
    const handle = createDropHandler(document, () => 2)
    handle({ type: "enter", paths: ["/a.png", "/b.png"], position: { x: 20, y: 20 } })
    handle({ type: "drop", paths: ["/a.png", "/b.png"], position: { x: 20, y: 20 } })
    expect(seen).toEqual(["/a.png"])
    expect(field.hasAttribute("data-drop-target")).toBe(false)
  })

  it("ignores a drop outside any field, and one with no paths", () => {
    const { field, input, other } = fieldDom()
    stubHitTest({ "10,10": input, "30,30": other })
    const listener = vi.fn()
    field.addEventListener(PATH_DROP_EVENT, listener)
    const handle = createDropHandler(document, () => 1)
    handle({ type: "drop", paths: ["/a.png"], position: { x: 30, y: 30 } })
    handle({ type: "drop", paths: [], position: { x: 10, y: 10 } })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("PathField on a drop", () => {
  const drop = (el: Element, path: string) =>
    act(() => {
      el.dispatchEvent(new CustomEvent(PATH_DROP_EVENT, { detail: { path } }))
    })

  it("commits the dropped path like a pick", () => {
    const onCommit = vi.fn()
    render(<PathField label="Texture" value="/old.png" onCommit={onCommit} />)
    drop(document.querySelector(PATH_FIELD_SELECTOR) as Element, "/new.png")
    expect(onCommit).toHaveBeenCalledWith("/new.png")
  })

  it("ignores a drop when read-only or disabled", () => {
    const onCommit = vi.fn()
    render(
      <>
        <PathField label="Locked" value="/a.png" />
        <PathField label="Off" value="/a.png" onCommit={onCommit} disabled />
      </>,
    )
    for (const el of document.querySelectorAll(PATH_FIELD_SELECTOR)) drop(el, "/new.png")
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Locked")).toBeTruthy()
  })

  it("follows a changed onCommit without resubscribing", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<PathField value={null} onCommit={first} />)
    rerender(<PathField value={null} onCommit={second} />)
    drop(document.querySelector(PATH_FIELD_SELECTOR) as Element, "/x.png")
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith("/x.png")
  })
})
