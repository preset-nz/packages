import type { ReactNode } from "react"

/** The title and one line of what the document is, shared by all four. */
export function DocHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      {children && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{children}</p>}
    </header>
  )
}
