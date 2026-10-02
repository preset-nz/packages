import { useSyncExternalStore } from "react"

import type { Row } from "./rhizome"

// Interaction state, kept out of the rhizome document (guidance/design/interaction-state.md):
// small stores, a discriminated union, narrow setters, no setSelection. Selection is not an
// undo step; undo and redo leave it alone, and a selection whose target is gone reads as none.

function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: T) {
      if (Object.is(next, state)) return
      state = next
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}

const useStore = <T>(s: ReturnType<typeof createStore<T>>) => useSyncExternalStore(s.subscribe, s.get)

/** The item inside the open document that the inspector follows. Which kinds apply depends on the document. */
export type Selection =
  | { kind: "none" }
  | { kind: "token"; name: string } // Tokens: a CSS variable, `--background`
  | { kind: "font"; role: string } // Fonts: a role, `Heading`
  | { kind: "value"; key: string } // Primitives: a value key of the document node
  | { kind: "layer"; id: string } // Card: a layer node
  | { kind: "system"; id: string } // Messages: the toast system, `snackbar`

const NONE: Selection = { kind: "none" }

// Two scopes, as interaction-state.md asks: which document is open (navigation, driven by the
// outline) and which item is selected inside it (driven by the centre view). Opening a
// document clears the item, so the pair can't disagree.
const openDoc = createStore<string | null>(null)
const item = createStore<Selection>(NONE)

export const useOpenDocumentId = () => useStore(openDoc)
export const useSelection = () => useStore(item)

export const openDocument = (id: string) => {
  if (openDoc.get() !== id) item.set(NONE)
  openDoc.set(id)
}
export const clearSelection = () => item.set(NONE)
export const selectToken = (name: string) => item.set({ kind: "token", name })
export const selectFont = (role: string) => item.set({ kind: "font", role })
export const selectValue = (key: string) => item.set({ kind: "value", key })
export const selectSystem = (id: string) => item.set({ kind: "system", id })
export const selectLayer = (id: string) => item.set({ kind: "layer", id })

/** The selection, if it makes sense for the open document and its target exists. */
export function resolveSelection(sel: Selection, doc: Row | null, layers: Row[]): Selection {
  switch (sel.kind) {
    case "token":
      return doc?.type === "tokens" ? sel : NONE
    case "font":
      return doc?.type === "fonts" ? sel : NONE
    case "value":
      return doc?.type === "primitives" && sel.key in (doc.values ?? {}) ? sel : NONE
    case "layer":
      return doc?.type === "card" && layers.some((l) => l.id === sel.id) ? sel : NONE
    case "system":
      return doc?.type === "messages" ? sel : NONE
    default:
      return NONE
  }
}

/** Where the selection is, for the status bar: the document's path, then the item. */
export function selectionPath(sel: Selection, doc: Row | null, layers: Row[]): string {
  if (!doc) return "none"
  switch (sel.kind) {
    case "token":
      return `${doc.path}/${sel.name}`
    case "font":
      return `${doc.path}/${sel.role}`
    case "value":
      return `${doc.path}#${sel.key}`
    case "layer":
      return layers.find((l) => l.id === sel.id)?.path ?? doc.path
    case "system":
      return `${doc.path}/${sel.id}`
    default:
      return doc.path
  }
}

// Sample text typed in the inspector for a font role; the specimens in the centre show it.
const samples = createStore<Record<string, string>>({})
export const useFontSamples = () => useStore(samples)
export const setFontSample = (role: string, text: string) => samples.set({ ...samples.get(), [role]: text })
