import { useState } from "react"
import {
  ColorField,
  ColorSwatch,
  Icons,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarItems,
  ToolbarSeparator,
  TooltipProvider,
  type ToolbarItemSpec,
} from "@preset.nz/ux-kit"

const PRESETS = ["#ffffff", "#f8f5e7", "#efe7d3", "#cccccc", "#e5484d", "#3e63dd", "#000000"]

type Tool = "move" | "marquee" | "pen"

export function ToolbarPage() {
  const [tool, setTool] = useState<Tool>("move")
  const [grid, setGrid] = useState(true)
  const [left, setLeft] = useState(true)
  const [right, setRight] = useState(true)
  const [hasSelection, setHasSelection] = useState(false)
  const [sidecarUp, setSidecarUp] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const [fill, setFill] = useState<string | null>("#3e63dd")
  const [stroke, setStroke] = useState<string | null>("#e5484d80")
  const [optional, setOptional] = useState<string | null>(null)

  // The item table: ids are command ids, the menu would read the same table.
  const tools: ToolbarItemSpec[] = [
    { id: "tool.move", label: "Move", icon: <Icons.CursorIcon />, shortcut: "V", pressed: tool === "move" },
    { id: "tool.marquee", label: "Marquee", icon: <Icons.SelectionIcon />, shortcut: "M", pressed: tool === "marquee" },
    { id: "tool.pen", label: "Pen", icon: <Icons.PenNibIcon />, shortcut: "P", pressed: tool === "pen" },
    {
      id: "tool.smart",
      label: "Smart select",
      icon: <Icons.MagicWandIcon />,
      enabled: sidecarUp,
      disabledReason: "Sidecar not running",
    },
  ]
  const edit: ToolbarItemSpec[] = [
    { id: "edit.duplicate", label: "Duplicate", icon: <Icons.CopyIcon />, shortcut: "⌘D", enabled: hasSelection, disabledReason: "Nothing selected" },
    { id: "edit.delete", label: "Delete", icon: <Icons.TrashIcon />, shortcut: "⌫", enabled: hasSelection, disabledReason: "Nothing selected" },
    { id: "view.grid", label: "Grid", icon: <Icons.GridFourIcon />, shortcut: "⌘'", pressed: grid },
    {
      id: "export",
      label: "Export",
      icon: <Icons.ExportIcon />,
      menu: [
        { id: "export.png", label: "PNG", shortcut: "⌘E" },
        { id: "export.svg", label: "SVG" },
        { id: "export.pdf", label: "PDF", enabled: false },
      ],
    },
  ]

  const run = (id: string) => {
    setLog((l) => [id, ...l].slice(0, 5))
    if (id.startsWith("tool.") && id !== "tool.smart") setTool(id.slice(5) as Tool)
    if (id === "view.grid") setGrid((g) => !g)
    if (id === "panel.left") setLeft((v) => !v)
    if (id === "panel.right") setRight((v) => !v)
  }

  return (
    <TooltipProvider delay={300}>
      <section className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-heading text-2xl font-semibold">Toolbar and colour</h1>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Toolbar, from an item table</h2>
          <div className="overflow-hidden rounded-md border border-border">
            <ToolbarItems
              aria-label="Demo toolbar"
              leading={[{ id: "panel.left", label: "Left panel", icon: <Icons.SidebarSimpleIcon />, shortcut: "⌥⌘S", pressed: left }]}
              groups={[tools, edit]}
              trailing={[{ id: "panel.right", label: "Right panel", icon: <Icons.SidebarSimpleIcon className="-scale-x-100" />, shortcut: "⌥⌘I", pressed: right }]}
              onCommand={run}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={hasSelection} onChange={(e) => setHasSelection(e.target.checked)} />
              Selection exists
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={sidecarUp} onChange={(e) => setSidecarUp(e.target.checked)} />
              Sidecar up
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Last commands: {log.length ? log.join(", ") : "none"}. Hover a disabled item for its reason; arrow keys move between items.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Composed, for anything the table cannot say</h2>
          <div className="overflow-hidden rounded-md border border-border">
            <Toolbar aria-label="Composed toolbar">
              <ToolbarGroup>
                <ToolbarButton label="Undo" icon={<Icons.ArrowCounterClockwiseIcon />} shortcut="⌘Z" enabled={false} disabledReason="Nothing to undo" />
                <ToolbarButton label="Redo" icon={<Icons.ArrowClockwiseIcon />} shortcut="⇧⌘Z" />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ColorSwatch color={fill} size="md" aria-label="Current fill" />
            </Toolbar>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">ColorField</h2>
          <div className="grid max-w-md gap-3">
            <ColorField label="Fill (presets, native picker)" value={fill} onChange={setFill} presets={PRESETS} />
            <ColorField label="Stroke (with alpha)" value={stroke} onChange={setStroke} alpha presets={PRESETS} />
            <ColorField label="Optional (clearable, empty)" value={optional} onChange={setOptional} presets={PRESETS} clearable fallback="#888888" />
            <ColorField label="Read-only" value="#3e63dd" />
            <ColorField label="Disabled" value="#3e63dd" onChange={() => {}} disabled />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Swatches:
            <ColorSwatch color="#3e63dd" size="sm" />
            <ColorSwatch color="#3e63dd" />
            <ColorSwatch color="#e5484d80" size="lg" />
            <ColorSwatch color="#3e63dd" shape="round" />
            <ColorSwatch color={null} shape="round" />
          </div>
        </div>
      </section>
    </TooltipProvider>
  )
}
