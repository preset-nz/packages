// rhizome stores a Colour as [r, g, b, a], each 0 to 1. ColorField speaks #rrggbbaa.

const byte = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0")

export function colourToHex(c: unknown): string | null {
  if (!Array.isArray(c) || c.length !== 4) return null
  return `#${byte(c[0])}${byte(c[1])}${byte(c[2])}${byte(c[3])}`
}

export function hexToColour(hex: string): [number, number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(hex)
  if (!m) return null
  const n = (s: string) => parseInt(s, 16) / 255
  return [n(m[1]), n(m[2]), n(m[3]), m[4] ? n(m[4]) : 1]
}
