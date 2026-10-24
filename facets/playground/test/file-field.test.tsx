import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useMemo, useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  type FileHandlers,
  filtersOf,
  PropertyPanel,
  registerBuiltinRenderers,
  registerFileHandlers,
  registerScope,
  type WriteResult,
} from "../../src"

beforeAll(registerBuiltinRenderers)
afterEach(() => {
  cleanup()
  registerFileHandlers(null)
})

interface Host {
  write: (value: unknown) => WriteResult
}

registerScope<{ value: unknown }, Record<string, unknown>>("file-test", {
  schema: {
    version: 1,
    groups: [
      {
        id: "g",
        rows: [
          {
            kind: "file",
            id: "tex",
            path: "tex",
            label: "Texture Path",
            recentKey: "texture",
            filters: [{ name: "Images", extensions: ["png"] }],
          },
        ],
      },
    ],
  },
  read: (sel) => ({ tex: sel.value }),
  write: (_path, value, _sel, ctx: Host) => ctx.write(value),
})

/**
 * A host: it owns the value, and `check` is its command. It returns an error to refuse, or
 * nothing to accept (the value then changes, as a mirror update would).
 */
function Panel({
  initial = null,
  check = () => undefined,
  readOnly,
  onWrite,
}: {
  initial?: unknown
  check?: (value: unknown) => WriteResult
  readOnly?: boolean
  onWrite?: (value: unknown) => void
}) {
  const [value, setValue] = useState<unknown>(initial)
  const selection = useMemo(() => ({ value }), [value])
  const ctx = useMemo<Host>(
    () => ({
      write: (v) => {
        onWrite?.(v)
        const out = check(v)
        const accept = () => setValue(v)
        if (out && typeof (out as Promise<unknown>).then === "function") {
          return (out as Promise<{ error: string } | undefined>).then((r) => {
            if (!r) accept()
            return r
          })
        }
        if (out) return out
        accept()
      },
    }),
    [check, onWrite],
  )
  return <PropertyPanel scopeKey="file-test" selection={selection} ctx={ctx} readOnly={readOnly} />
}

const input = () => screen.getByLabelText("Texture Path") as HTMLInputElement
const type = (text: string) => fireEvent.change(input(), { target: { value: text } })
const settle = () => act(async () => {})

describe("file field", () => {
  it("commits on Return, once", () => {
    const onWrite = vi.fn()
    render(<Panel onWrite={onWrite} />)
    type("a.png")
    expect(onWrite).not.toHaveBeenCalled()
    fireEvent.keyDown(input(), { key: "Enter" })
    fireEvent.blur(input())
    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(onWrite).toHaveBeenCalledWith("a.png")
    expect(input().value).toBe("a.png")
  })

  it("commits on blur", () => {
    const onWrite = vi.fn()
    render(<Panel initial="old.png" onWrite={onWrite} />)
    type("new.png")
    fireEvent.blur(input())
    expect(onWrite).toHaveBeenCalledWith("new.png")
  })

  it("commits null for emptied text", () => {
    const onWrite = vi.fn()
    render(<Panel initial="old.png" onWrite={onWrite} />)
    type("  ")
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onWrite).toHaveBeenCalledWith(null)
  })

  it("reverts on Esc and writes nothing", () => {
    const onWrite = vi.fn()
    render(<Panel initial="old.png" onWrite={onWrite} />)
    type("typed.png")
    fireEvent.keyDown(input(), { key: "Escape" })
    expect(input().value).toBe("old.png")
    fireEvent.blur(input())
    expect(onWrite).not.toHaveBeenCalled()
  })

  it("shows the host's refusal and keeps the typed text", () => {
    render(<Panel initial="old.png" check={() => ({ error: "Not an image" })} />)
    type("notes.txt")
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(screen.getByText("Not an image")).toBeTruthy()
    expect(input().value).toBe("notes.txt")
    expect(input().getAttribute("aria-invalid")).toBe("true")
  })

  it("shows a rejected write's message, and clears it on the next attempt", async () => {
    let fail = true
    const check = () => (fail ? Promise.reject("Not an image") : Promise.resolve())
    render(<Panel initial="old.png" check={check} />)
    type("notes.txt")
    fireEvent.keyDown(input(), { key: "Enter" })
    await settle()
    expect(screen.getByText("Not an image")).toBeTruthy()
    fail = false
    type("ok.png")
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(screen.queryByText("Not an image")).toBeNull()
    await settle()
    expect(input().value).toBe("ok.png")
  })

  it("is a plain text field with no handlers", () => {
    render(<Panel />)
    expect((screen.getByLabelText("Recent") as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByLabelText("Choose File…")).toBeNull()
    type("anything/at/all.png")
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(input().value).toBe("anything/at/all.png")
    expect(screen.queryByText("Missing")).toBeNull()
  })

  it("is read-only in a read-only panel", () => {
    render(<Panel initial="old.png" readOnly />)
    expect(input().readOnly).toBe(true)
    expect(screen.queryByLabelText("Choose File…")).toBeNull()
  })

  it("still draws the old { name } value, read-only", () => {
    render(<Panel initial={{ name: "harbour.jpg" }} />)
    expect(screen.getByText("harbour.jpg")).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})

describe("file field with handlers", () => {
  const handlers = (more: Partial<FileHandlers> = {}): FileHandlers => ({
    recent: vi.fn(async () => ["/a/one.png", "/a/gone.png", "/a/two.png"]),
    exists: vi.fn(async (paths: string[]) => paths.map((p) => !p.includes("gone"))),
    remember: vi.fn(async () => {}),
    pick: vi.fn(async () => "/picked/new.png"),
    ...more,
  })

  it("leaves gone recents out of the ▾ list", async () => {
    registerFileHandlers(handlers())
    render(<Panel />)
    await settle()
    fireEvent.click(screen.getByLabelText("Recent"))
    const list = screen.getByRole("list", { name: "Recent files" })
    expect(list.textContent).toContain("/a/one.png")
    expect(list.textContent).toContain("/a/two.png")
    expect(list.textContent).not.toContain("gone")
  })

  it("asks for the list of its recentKey", async () => {
    const h = handlers()
    registerFileHandlers(h)
    render(<Panel />)
    await settle()
    expect(h.recent).toHaveBeenCalledWith("texture")
  })

  it("remembers a path only once the host has accepted it", async () => {
    const h = handlers()
    registerFileHandlers(h)
    render(<Panel check={(v) => (v === "bad.txt" ? { error: "Not an image" } : undefined)} />)
    await settle()

    type("bad.txt")
    fireEvent.keyDown(input(), { key: "Enter" })
    await settle()
    expect(h.remember).not.toHaveBeenCalled()

    type("good.png")
    fireEvent.keyDown(input(), { key: "Enter" })
    await settle()
    expect(h.remember).toHaveBeenCalledTimes(1)
    expect(h.remember).toHaveBeenCalledWith("texture", "good.png")
  })

  it("waits for an asynchronous host before remembering", async () => {
    const h = handlers()
    registerFileHandlers(h)
    let accept: () => void = () => {}
    const check = () => new Promise<void>((resolve) => (accept = resolve))
    render(<Panel check={check} />)
    await settle()
    type("slow.png")
    fireEvent.keyDown(input(), { key: "Enter" })
    await settle()
    expect(h.remember).not.toHaveBeenCalled()
    accept()
    await settle()
    expect(h.remember).toHaveBeenCalledWith("texture", "slow.png")
  })

  it("commits a pick from the dialog with the field's filters", async () => {
    const h = handlers()
    registerFileHandlers(h)
    const onWrite = vi.fn()
    render(<Panel onWrite={onWrite} />)
    await settle()
    fireEvent.click(screen.getByLabelText("Choose File…"))
    await settle()
    expect(h.pick).toHaveBeenCalledWith({
      filters: [{ name: "Images", extensions: ["png"] }],
      title: undefined,
    })
    expect(onWrite).toHaveBeenCalledWith("/picked/new.png")
    expect(h.remember).toHaveBeenCalledWith("texture", "/picked/new.png")
  })

  it("shows Missing for a gone value, and recovers when the window regains focus", async () => {
    let there = false
    const h = handlers({ exists: vi.fn(async (paths: string[]) => paths.map(() => there)) })
    registerFileHandlers(h)
    render(<Panel initial="/a/gone.png" />)
    await settle()
    expect(screen.getByText("Missing")).toBeTruthy()
    there = true
    act(() => {
      window.dispatchEvent(new Event("focus"))
    })
    await settle()
    expect(screen.queryByText("Missing")).toBeNull()
  })

  describe("context menu", () => {
    const rightClick = () => fireEvent.contextMenu(input())

    it("offers Reveal and Clear, and reveals", async () => {
      const contextMenu = vi.fn(async () => "reveal" as const)
      const reveal = vi.fn()
      registerFileHandlers(handlers({ contextMenu, reveal, base: () => "/doc" }))
      render(<Panel initial="/a/one.png" />)
      await settle()
      rightClick()
      await settle()
      expect(contextMenu).toHaveBeenCalledWith({ missing: false, canClear: true })
      expect(reveal).toHaveBeenCalledWith("/a/one.png", "/doc")
    })

    it("clears through the host's command", async () => {
      const onWrite = vi.fn()
      registerFileHandlers(handlers({ contextMenu: async () => "clear" }))
      render(<Panel initial="/a/one.png" onWrite={onWrite} />)
      await settle()
      rightClick()
      await settle()
      expect(onWrite).toHaveBeenCalledWith(null)
      expect(input().value).toBe("")
    })

    it("tells the menu the file is missing", async () => {
      const contextMenu = vi.fn(async () => null)
      registerFileHandlers(handlers({ contextMenu }))
      render(<Panel initial="/a/gone.png" />)
      await settle()
      rightClick()
      await settle()
      expect(contextMenu).toHaveBeenCalledWith({ missing: true, canClear: true })
    })

    it("leaves the text menu to the input while the text is being edited", async () => {
      const contextMenu = vi.fn(async () => null)
      registerFileHandlers(handlers({ contextMenu }))
      render(<Panel initial="/a/one.png" />)
      await settle()
      input().focus()
      fireEvent.mouseDown(input(), { button: 2 })
      const notPrevented = rightClick()
      expect(contextMenu).not.toHaveBeenCalled()
      expect(notPrevented).toBe(true)
    })
  })
})

describe("filtersOf", () => {
  it("prefers filters, and maps the extensions of accept otherwise", () => {
    const images = [{ name: "Images", extensions: ["png"] }]
    expect(filtersOf({ filters: images, accept: ".jpg" })).toEqual(images)
    expect(filtersOf({ accept: ".png, .jpg,image/*" })).toEqual([
      { name: "Files", extensions: ["png", "jpg"] },
    ])
    expect(filtersOf({ accept: "image/*" })).toBeUndefined()
    expect(filtersOf({})).toBeUndefined()
  })
})
