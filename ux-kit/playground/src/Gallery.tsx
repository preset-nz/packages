import { cn, Icons } from "@preset.nz/ux-kit"
import { useState } from "react"

import { Primitives } from "./pages/Primitives"
import { Tokens } from "./pages/Tokens"
import { ToolbarPage } from "./pages/Toolbar"
import { useTheme } from "./theme"

const SECTIONS = [
  { id: "tokens", label: "Tokens", Icon: Icons.PaletteIcon },
  { id: "primitives", label: "Primitives", Icon: Icons.CubeIcon },
  { id: "toolbar", label: "Toolbar and colour", Icon: Icons.ToolboxIcon },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

/** The Gallery window: the kit's tokens, primitives and toolbar pages, with a sidebar. */
export function Gallery() {
  const [section, setSection] = useState<SectionId>("tokens")
  const { dark, toggle } = useTheme()

  return (
    <div className="flex h-screen">
      <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              section === id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50",
            )}
          >
            <Icon weight={section === id ? "fill" : "regular"} className="size-4" />
            {label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {section === "tokens" && <Tokens dark={dark} onToggleTheme={toggle} />}
        {section === "primitives" && <Primitives />}
        {section === "toolbar" && <ToolbarPage />}
      </main>
    </div>
  )
}
