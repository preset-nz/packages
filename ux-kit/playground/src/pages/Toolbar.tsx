import {
  recentPaths as loadRecent,
  pickFile,
  rememberPath,
  useMissingCheck,
} from "@preset.nz/app-kit"
import {
  ColorField,
  ColorSwatch,
  Icons,
  PathField,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  type ToolbarItemSpec,
  ToolbarItems,
  ToolbarSeparator,
  TooltipProvider,
} from "@preset.nz/ux-kit"
import { useEffect, useState } from "react"

const PRESETS = ["#ffffff", "#f8f5e7", "#efe7d3", "#cccccc", "#e5484d", "#3e63dd", "#000000"]

const FAKE_RECENT = [
  "/Users/georg/textures/vellum.jpg",
  "textures/parchment-old.png",
  "/Users/georg/Pictures/maps/coast/sea-noise.webp",
]

/** Stands in for the native Open dialog: resolves a made-up absolute path after 300 ms. */
const fakeBrowse = () =>
  new Promise<string | null>((resolve) =>
    setTimeout(() => resolve("/Users/georg/Pictures/chosen-in-dialog.jpg"), 300),
  )

const REAL_KEY = "playground-texture"

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

  const [recentPaths, setRecentPaths] = useState<string[]>(FAKE_RECENT)
  const [emptyPath, setEmptyPath] = useState<string | null>(null)
  const [setPath, setSetPath] = useState<string | null>("/Users/georg/textures/vellum.jpg")
  const [relPath, setRelPath] = useState<string | null>("textures/vellum.jpg")
  const [badPath, setBadPath] = useState<string | null>("notes/readme.txt")
  // Commits push onto the recent list: newest first, deduped, at most 10.
  const remember = (set: (p: string | null) => void) => (p: string | null) => {
    set(p)
    if (p) setRecentPaths((r) => [p, ...r.filter((x) => x !== p)].slice(0, 10))
  }

  // Real dialog (app-kit): the recent list, Open dialog and Missing check are app-kit's commands.
  const [realPath, setRealPath] = useState<string | null>(null)
  const [realRecent, setRealRecent] = useState<string[]>([])
  const refreshReal = () => loadRecent(REAL_KEY).then(setRealRecent, () => {})
  // biome-ignore lint/correctness/useExhaustiveDependencies: loads once on mount
  useEffect(() => {
    void refreshReal()
  }, [])
  const [realMissing] = useMissingCheck(realPath ? [realPath] : [])

  // The item table: ids are command ids, the menu would read the same table.
  const tools: ToolbarItemSpec[] = [
    {
      id: "tool.move",
      label: "Move",
      icon: <Icons.CursorIcon />,
      shortcut: "V",
      pressed: tool === "move",
    },
    {
      id: "tool.marquee",
      label: "Marquee",
      icon: <Icons.SelectionIcon />,
      shortcut: "M",
      pressed: tool === "marquee",
    },
    {
      id: "tool.pen",
      label: "Pen",
      icon: <Icons.PenNibIcon />,
      shortcut: "P",
      pressed: tool === "pen",
    },
    {
      id: "tool.smart",
      label: "Smart select",
      icon: <Icons.MagicWandIcon />,
      enabled: sidecarUp,
      disabledReason: "Sidecar not running",
    },
  ]
  const edit: ToolbarItemSpec[] = [
    {
      id: "edit.duplicate",
      label: "Duplicate",
      icon: <Icons.CopyIcon />,
      shortcut: "⌘D",
      enabled: hasSelection,
      disabledReason: "Nothing selected",
    },
    {
      id: "edit.delete",
      label: "Delete",
      icon: <Icons.TrashIcon />,
      shortcut: "⌫",
      enabled: hasSelection,
      disabledReason: "Nothing selected",
    },
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
              leading={[
                {
                  id: "panel.left",
                  label: "Left panel",
                  icon: <Icons.SidebarSimpleIcon />,
                  shortcut: "⌥⌘S",
                  pressed: left,
                },
              ]}
              groups={[tools, edit]}
              trailing={[
                {
                  id: "panel.right",
                  label: "Right panel",
                  icon: <Icons.SidebarSimpleIcon className="-scale-x-100" />,
                  shortcut: "⌥⌘I",
                  pressed: right,
                },
              ]}
              onCommand={run}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={hasSelection}
                onChange={(e) => setHasSelection(e.target.checked)}
              />
              Selection exists
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={sidecarUp}
                onChange={(e) => setSidecarUp(e.target.checked)}
              />
              Sidecar up
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Last commands: {log.length ? log.join(", ") : "none"}. Hover a disabled item for its
            reason; arrow keys move between items.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Composed, for anything the table cannot say</h2>
          <div className="overflow-hidden rounded-md border border-border">
            <Toolbar aria-label="Composed toolbar">
              <ToolbarGroup>
                <ToolbarButton
                  label="Undo"
                  icon={<Icons.ArrowCounterClockwiseIcon />}
                  shortcut="⌘Z"
                  enabled={false}
                  disabledReason="Nothing to undo"
                />
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
            <ColorField
              label="Fill (presets, native picker)"
              value={fill}
              onChange={setFill}
              presets={PRESETS}
            />
            <ColorField
              label="Stroke (with alpha)"
              value={stroke}
              onChange={setStroke}
              alpha
              presets={PRESETS}
            />
            <ColorField
              label="Optional (clearable, empty)"
              value={optional}
              onChange={setOptional}
              presets={PRESETS}
              clearable
              fallback="#888888"
            />
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

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Path field</h2>
          <div className="grid max-w-xl gap-3">
            <PathField
              label="Empty, with recents"
              placeholder="No file"
              value={emptyPath}
              onCommit={remember(setEmptyPath)}
              recent={recentPaths}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="Texture Path"
              value={setPath}
              onCommit={remember(setSetPath)}
              recent={recentPaths}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="Relative"
              value={relPath}
              onCommit={remember(setRelPath)}
              recent={recentPaths}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="No recents"
              value={null}
              placeholder="No file"
              onCommit={() => {}}
              recent={[]}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="Missing"
              status="missing"
              value="textures/lost-vellum.jpg"
              onCommit={() => {}}
              recent={recentPaths}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="Invalid"
              status="invalid"
              message="Not an image: PNG, JPEG or WebP"
              value={badPath}
              onCommit={setBadPath}
              recent={recentPaths}
              onBrowse={fakeBrowse}
            />
            <PathField
              label="Real dialog (app-kit)"
              placeholder="No file"
              value={realPath}
              status={realMissing ? "missing" : "ok"}
              onCommit={(p) => {
                setRealPath(p)
                if (p) void rememberPath(REAL_KEY, p).then(refreshReal)
              }}
              recent={realRecent}
              onBrowse={() =>
                pickFile({
                  title: "Choose a texture",
                  filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
                })
              }
            />
            <PathField
              label="Read-only"
              value="/Users/georg/textures/vellum.jpg"
              recent={recentPaths}
            />
            <PathField
              label="Disabled"
              value="/Users/georg/textures/vellum.jpg"
              onCommit={() => {}}
              recent={recentPaths}
              onBrowse={fakeBrowse}
              disabled
            />
          </div>
        </div>
      </section>
    </TooltipProvider>
  )
}
