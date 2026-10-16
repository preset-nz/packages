// Literal class names, so Tailwind sees them. Sizes are Tailwind's type scale.
export const SIZES = [
  { cls: "text-xs", px: 12 },
  { cls: "text-sm", px: 14 },
  { cls: "text-base", px: 16 },
  { cls: "text-lg", px: 18 },
  { cls: "text-xl", px: 20 },
  { cls: "text-2xl", px: 24 },
  { cls: "text-3xl", px: 30 },
  { cls: "text-4xl", px: 36 },
] as const

export const WEIGHTS = [
  { cls: "font-normal", w: 400, name: "Regular" },
  { cls: "font-medium", w: 500, name: "Medium" },
  { cls: "font-semibold", w: 600, name: "Semibold" },
  { cls: "font-bold", w: 700, name: "Bold" },
] as const

export const ROLES = [
  { role: "Heading", token: "--font-heading", cls: "font-heading", sample: "Layers and masks" },
  {
    role: "Body",
    token: "--font-sans",
    cls: "font-sans",
    sample: "The quick brown fox jumps over the lazy dog",
  },
  {
    role: "Mono",
    token: "--font-mono",
    cls: "font-mono",
    sample: "const opacity = 0.75 // 0123456789",
  },
] as const

export type FontRole = (typeof ROLES)[number]
