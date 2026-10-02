import { Icons } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"

/** What each document node type is called and drawn as in the outline. Order is the outline's. */
export const DOCS = [
  { type: "tokens", label: "Tokens", Icon: Icons.PaletteIcon },
  { type: "fonts", label: "Fonts", Icon: Icons.TextAaIcon },
  { type: "primitives", label: "Primitives", Icon: Icons.SlidersHorizontalIcon },
  { type: "card", label: "Card", Icon: Icons.IdentificationCardIcon },
  { type: "messages", label: "Messages", Icon: Icons.ChatTextIcon },
] as const

export const docInfo = (type: string) => DOCS.find((d) => d.type === type)

/** The document rows in outline order. */
export function sortDocs(rows: Row[]): Row[] {
  const order = (r: Row) => DOCS.findIndex((d) => d.type === r.type)
  return rows.filter((r) => order(r) >= 0).sort((a, b) => order(a) - order(b))
}

/** Sets one value on a document node; see `useRhizome().set`. */
export type SetValue = (path: string, key: string, value: unknown, coalesce?: boolean) => void
