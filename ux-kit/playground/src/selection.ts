import { createSelection, createStore, useStore } from "@preset.nz/app-kit"

import type { Row } from "./rhizome"

// Interaction state, kept out of the rhizome document (guidance/design/interaction-state.md):
// small stores, a discriminated union, narrow setters, no setSelection. Selection is not an
// undo step; undo and redo leave it alone, and a selection whose target is gone reads as none.
// The stores come from app-kit; the kinds, the setters and the resolution below are the app's.

/** The item inside the open document that the inspector follows. Which kinds apply depends on the document. */
export type Selection =
  | { kind: "none" }
  | { kind: "token"; name: string } // Tokens: a CSS variable, `--background`
  | { kind: "font"; role: string } // Fonts: a role, `Heading`
  | { kind: "value"; key: string } // Primitives: a value key of the document node
  | { kind: "layer"; id: string } // Card: a layer node
  | { kind: "op"; id: string } // Ops: an op node
  | { kind: "system"; id: string } // Messages: the toast system, `snackbar`
  | { kind: "strata"; panel: "image" | "batch" } // Inspectors: one of Strata's panels

const NONE: Selection = { kind: "none" }

// Two scopes, as interaction-state.md asks: which document is open (navigation, driven by the
// outline) and which item is selected inside it (driven by the centre view). Opening a
// document clears the item, so the pair can't disagree.
const openDoc = createSelection<string | null>(null)
const item = createSelection<Selection>(NONE)

export const useOpenDocumentId = () => openDoc.use()
export const useSelection = () => item.use()

export const openDocument = (id: string) => {
  if (openDoc.get() !== id) item.clear()
  openDoc.select(id)
}
export const clearSelection = () => item.clear()
export const selectToken = (name: string) => item.select({ kind: "token", name })
export const selectFont = (role: string) => item.select({ kind: "font", role })
export const selectValue = (key: string) => item.select({ kind: "value", key })
export const selectSystem = (id: string) => item.select({ kind: "system", id })
export const selectLayer = (id: string) => item.select({ kind: "layer", id })
export const selectOp = (id: string) => item.select({ kind: "op", id })
export const selectStrataPanel = (panel: "image" | "batch") =>
  item.select({ kind: "strata", panel })

/** The selection, if it makes sense for the open document and its target exists. */
export function resolveSelection(
  sel: Selection,
  doc: Row | null,
  layers: Row[],
  ops: Row[],
): Selection {
  switch (sel.kind) {
    case "token":
      return doc?.type === "tokens" ? sel : NONE
    case "font":
      return doc?.type === "fonts" ? sel : NONE
    case "value":
      return doc?.type === "primitives" && sel.key in (doc.values ?? {}) ? sel : NONE
    case "layer":
      return doc?.type === "card" && layers.some((l) => l.id === sel.id) ? sel : NONE
    case "op":
      return doc?.type === "ops" && ops.some((o) => o.id === sel.id) ? sel : NONE
    case "system":
      return doc?.type === "messages" ? sel : NONE
    case "strata":
      return doc?.type === "inspectors" ? sel : NONE
    default:
      return NONE
  }
}

/** Where the selection is, for the status bar: the document's path, then the item. */
export function selectionPath(sel: Selection, doc: Row | null, layers: Row[], ops: Row[]): string {
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
    case "op":
      return ops.find((o) => o.id === sel.id)?.path ?? doc.path
    case "system":
      return `${doc.path}/${sel.id}`
    case "strata":
      return `${doc.path}/${sel.panel}`
    default:
      return doc.path
  }
}

// Sample text typed in the inspector for a font role; the specimens in the centre show it.
const samples = createStore<Record<string, string>>({})
export const useFontSamples = () => useStore(samples)
export const setFontSample = (role: string, text: string) =>
  samples.set({ ...samples.get(), [role]: text })
