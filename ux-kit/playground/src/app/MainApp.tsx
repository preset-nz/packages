import { useMemo, useState } from "react"
import {
  Icons,
  SidePanel,
  StatusBar,
  StatusItem,
  StatusSpacer,
  ToolbarItems,
  TooltipProvider,
} from "@preset.nz/ux-kit"

import { buildCommands, toItems, TOOLBAR } from "../commands"
import { sortDocs } from "../documents"
import { DOC_PREFIX, useRhizome } from "../rhizome"
import { useStored } from "../stored"
import { useTheme } from "../theme"
import { Inspector } from "./Inspector"
import { DocumentView } from "./DocumentView"
import { Outline } from "./Outline"
import { useMenuSync } from "./useMenuSync"
import { blurField, useTextUndo } from "../textUndo"

/** The main window: toolbar, outline of documents, the selected document, inspector, status bar. */
export function MainApp() {
  const { rows, history, error, call, set } = useRhizome()
  const { dark, toggle: toggleTheme } = useTheme()
  const [leftOpen, setLeftOpen] = useStored("left.open", true)
  const [rightOpen, setRightOpen] = useStored("right.open", true)
  const [leftWidth, setLeftWidth] = useStored("left.width", 240)
  const [rightWidth, setRightWidth] = useStored("right.width", 300)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const docs = useMemo(() => sortDocs(rows.filter((r) => r.path.startsWith(DOC_PREFIX))), [rows])
  // Selection is by node id; with none (or one that is gone) the first document shows.
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null
  const canReset = selected !== null && Object.keys(selected.values ?? {}).length > 0

  const commands = useMemo(
    () =>
      buildCommands({
        canReset,
        undoLabel: history?.undo_label ?? null,
        redoLabel: history?.redo_label ?? null,
        leftOpen,
        rightOpen,
        dark,
        reset: () => selected && call("rhizome_reset", { path: selected.path }),
        // Blur first: a focused field commits its text as one edit, then the undo takes that edit.
        undo: () => (blurField(), call("rhizome_undo")),
        redo: () => (blurField(), call("rhizome_redo")),
        toggleLeft: () => setLeftOpen((v) => !v),
        toggleRight: () => setRightOpen((v) => !v),
        toggleTheme,
      }),
    [selected, canReset, history, leftOpen, rightOpen, dark, call, setLeftOpen, setRightOpen, toggleTheme],
  )
  useMenuSync(commands, useTextUndo())

  const run = (id: string) => {
    const c = commands.find((x) => x.id === id)
    if (c?.enabled) c.run()
  }

  const done = history?.history_len ?? 0
  const total = done + (history?.redo_labels.length ?? 0)

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-screen flex-col">
        <ToolbarItems
          aria-label="Toolbar"
          leading={toItems(commands, TOOLBAR.leading)}
          groups={TOOLBAR.groups.map((ids) => toItems(commands, ids))}
          trailing={toItems(commands, TOOLBAR.trailing)}
          onCommand={run}
        />
        <div className="flex min-h-0 flex-1">
          <SidePanel
            side="left"
            title="Outline"
            icon={<Icons.TreeStructureIcon />}
            shortcut="⌥⌘S"
            open={leftOpen}
            onOpenChange={setLeftOpen}
            width={leftWidth}
            onWidthChange={setLeftWidth}
          >
            <Outline docs={docs} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </SidePanel>
          <main className="min-w-0 flex-1 overflow-auto">
            <DocumentView doc={selected} set={set} />
          </main>
          <SidePanel
            side="right"
            title="Inspector"
            icon={<Icons.SlidersHorizontalIcon />}
            shortcut="⌥⌘I"
            open={rightOpen}
            onOpenChange={setRightOpen}
            width={rightWidth}
            onWidthChange={setRightWidth}
          >
            <Inspector doc={selected} history={history} />
          </SidePanel>
        </div>
        <StatusBar>
          <StatusItem label="Documents">{docs.length}</StatusItem>
          <StatusItem label="History">
            {done} of {total}
          </StatusItem>
          <StatusItem label="Selection">{selected?.path ?? "none"}</StatusItem>
          <StatusSpacer />
          {error && <span className="truncate text-destructive">{error}</span>}
        </StatusBar>
      </div>
    </TooltipProvider>
  )
}
