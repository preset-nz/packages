import type { ReactNode } from "react"

/** Every document's outer frame: left-aligned, same gutter and width, so headings never jump. */
export const DOC_PAGE = "w-full max-w-5xl p-6"

/** The title and one line of what the document is, shared by every document. */
export function DocHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      {children && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{children}</p>}
    </header>
  )
}
