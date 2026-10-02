import { useCallback, useMemo, useState } from "react"
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
import { NOTE_PREFIX, useRhizome } from "../rhizome"
import { useStored } from "../stored"
import { useTheme } from "../theme"
import { Inspector } from "./Inspector"
import { NoteEditor } from "./NoteEditor"
import { Outline } from "./Outline"
import { useMenuSync } from "./useMenuSync"
import { blurField, useTextUndo } from "../textUndo"

/** The main window: toolbar, outline, note, inspector, status bar. */
export function MainApp() {
  const { rows, history, error, call } = useRhizome()
  const { dark, toggle: toggleTheme } = useTheme()
  const [leftOpen, setLeftOpen] = useStored("left.open", true)
  const [rightOpen, setRightOpen] = useStored("right.open", true)
  const [leftWidth, setLeftWidth] = useStored("left.width", 240)
  const [rightWidth, setRightWidth] = useStored("right.width", 300)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const notes = useMemo(() => rows.filter((r) => r.path.startsWith(NOTE_PREFIX)), [rows])
  // Selection is by node id, so it survives a rename; a removed or undone-away note drops out.
  const selected = notes.find((n) => n.id === selectedId) ?? null

  const addNote = useCallback(async () => {
    const id = await call<string>("rhizome_add_note")
    if (id) setSelectedId(id)
  }, [call])

  const commands = useMemo(
    () =>
      buildCommands({
        hasSelection: selected !== null,
        undoLabel: history?.undo_label ?? null,
        redoLabel: history?.redo_label ?? null,
        leftOpen,
        rightOpen,
        dark,
        addNote,
        removeNote: () => selected && call("rhizome_remove", { path: selected.path }),
        // Blur first: a focused field commits its text as one edit, then the undo takes that edit.
        undo: () => (blurField(), call("rhizome_undo")),
        redo: () => (blurField(), call("rhizome_redo")),
        toggleLeft: () => setLeftOpen((v) => !v),
        toggleRight: () => setRightOpen((v) => !v),
        toggleTheme,
      }),
    [selected, history, leftOpen, rightOpen, dark, addNote, call, setLeftOpen, setRightOpen, toggleTheme],
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
            <Outline notes={notes} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </SidePanel>
          <main className="min-w-0 flex-1 overflow-auto">
            <NoteEditor
              note={selected}
              empty={notes.length === 0}
              onRename={(path, name) => call("rhizome_rename", { path, name })}
              onSetBody={(path, body) => call("rhizome_set_body", { path, body })}
            />
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
            <Inspector
              note={selected}
              history={history}
              onSetColour={(path, colour) => call("rhizome_set_colour", { path, colour })}
            />
          </SidePanel>
        </div>
        <StatusBar>
          <StatusItem label="Notes">{notes.length}</StatusItem>
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
