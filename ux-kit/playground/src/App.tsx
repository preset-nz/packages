import { useCallback, useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { cn, Icons } from "@preset.nz/ux-kit"

import { MENU_EVENTS, type MenuEvent } from "./menu"
import { Tokens } from "./pages/Tokens"
import { Primitives } from "./pages/Primitives"
import { Composites } from "./pages/Composites"
import { ToolbarPage } from "./pages/Toolbar"
import { Placeholder } from "./pages/Placeholder"

const SECTIONS = [
  { id: "tokens", label: "Tokens", Icon: Icons.PaletteIcon },
  { id: "primitives", label: "Primitives", Icon: Icons.CubeIcon },
  { id: "composites", label: "Composites", Icon: Icons.TreeStructureIcon },
  { id: "toolbar", label: "Toolbar and colour", Icon: Icons.ToolboxIcon },
  { id: "native", label: "Native", Icon: Icons.AppWindowIcon },
  { id: "settings", label: "Settings", Icon: Icons.GearIcon },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function App() {
  const [section, setSection] = useState<SectionId>("tokens")
  const [dark, setDark] = useState(prefersDark)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  const toggleTheme = useCallback(() => setDark((d) => !d), [])

  // One handler per command: the menu, and anything on screen, call these.
  useEffect(() => {
    const handlers: Record<MenuEvent, () => void> = {
      "menu://app/settings": () => setSection("settings"),
      "menu://view/toggle-theme": toggleTheme,
      "menu://view/section/tokens": () => setSection("tokens"),
      "menu://view/section/primitives": () => setSection("primitives"),
      "menu://view/section/composites": () => setSection("composites"),
      "menu://view/section/native": () => setSection("native"),
    }
    const unlisten = MENU_EVENTS.map((name) => listen(name, handlers[name]))
    return () => {
      unlisten.forEach((p) => p.then((fn) => fn()))
    }
  }, [toggleTheme])

  return (
    <div className="flex h-screen">
      <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-sidebar-border bg-sidebar p-2 pt-10 text-sidebar-foreground">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
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
        {section === "tokens" && <Tokens dark={dark} onToggleTheme={toggleTheme} />}
        {section === "primitives" && <Primitives />}
        {section === "composites" && <Composites />}
        {section === "toolbar" && <ToolbarPage />}
        {section === "native" && (
          <Placeholder title="Native" note="Menu, undo, window restore: the rules in native-apps.md, as components." />
        )}
        {section === "settings" && (
          <Placeholder title="Settings" note="The Settings window, rendered from a schema through facets." />
        )}
      </main>
    </div>
  )
}
