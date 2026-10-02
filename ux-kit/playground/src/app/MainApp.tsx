import { useEffect, useMemo } from "react"
import {
  Icons,
  notify,
  SidePanel,
  SnackbarProvider,
  SnackbarViewport,
  StatusBar,
  StatusItem,
  StatusSpacer,
  TooltipProvider,
} from "@preset.nz/ux-kit"

import { CommandToolbar, useCommands, undo } from "@preset.nz/app-kit"

import { buildBindings, TOOLBAR } from "../commands"
import { docInfo, sortDocs } from "../documents"
import { DOC_PREFIX, LAYER_PREFIX, useRhizome } from "../rhizome"
import {
  clearSelection,
  openDocument,
  resolveSelection,
  selectionPath,
  selectLayer,
  useOpenDocumentId,
  useSelection,
} from "../selection"
import { useStored } from "../stored"
import { useTheme } from "../theme"
import { Inspector } from "./Inspector"
import { DocumentView } from "./DocumentView"
import { Outline } from "./Outline"
import { resetTarget } from "./reset"

/** The main window: toolbar, outline of documents, the selected document, inspector, status bar. */
export function MainApp() {
  const { rows, schema, error, call, set, gesture } = useRhizome()
  const { dark, toggle: toggleTheme } = useTheme()
  const [leftOpen, setLeftOpen] = useStored("left.open", true)
  const [rightOpen, setRightOpen] = useStored("right.open", true)
  const [leftWidth, setLeftWidth] = useStored("left.width", 240)
  const [rightWidth, setRightWidth] = useStored("right.width", 300)
  const openId = useOpenDocumentId()
  const itemSelection = useSelection()

  const docs = useMemo(() => sortDocs(rows.filter((r) => r.path.startsWith(DOC_PREFIX))), [rows])
  const layers = useMemo(() => rows.filter((r) => r.path.startsWith(LAYER_PREFIX)), [rows])
  // The open document is by node id; with none (or one that is gone) the first shows.
  const selected = docs.find((d) => d.id === openId) ?? docs[0] ?? null
  const selection = resolveSelection(itemSelection, selected, layers)
  const reset = resetTarget(selected, selection, layers)
  const canReset = reset.target !== null

  // Escape clears the item, except in a field, where it puts the typed text back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return
      clearSelection()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const resetKeys = (path: string, keys: string[]) => call("rhizome_reset", { path, keys })

  const bindings = useMemo(
    () =>
      buildBindings({
        canReset,
        resetReason: reset.reason ?? "",
        leftOpen,
        rightOpen,
        dark,
        reset: () => {
          if (!reset.target) return
          const label = (selected && docInfo(selected.type)?.label) ?? selected?.name ?? "document"
          void call("rhizome_reset", { path: reset.target.path, keys: reset.target.keys }).then((r) => {
            if (r === undefined) return // failed: the status bar shows the error
            notify({
              message: `Reset ${label}`,
              action: { label: "Undo", onClick: () => void undo() },
            })
          })
        },
        toggleLeft: () => setLeftOpen((v) => !v),
        toggleRight: () => setRightOpen((v) => !v),
        toggleTheme,
      }),
    [reset.target, reset.reason, selected, canReset, leftOpen, rightOpen, dark, call, setLeftOpen, setRightOpen, toggleTheme],
  )
  const { commands, run, shortcut, history } = useCommands(bindings)

  const done = history?.historyLen ?? 0
  const total = done + (history?.redoLabels.length ?? 0)

  return (
    <TooltipProvider delay={300}>
      <SnackbarProvider>
        <div className="flex h-screen flex-col">
          <CommandToolbar aria-label="Toolbar" commands={commands} layout={TOOLBAR} run={run} />
          <div className="flex min-h-0 flex-1">
            <SidePanel
              side="left"
              title="Outline"
              icon={<Icons.TreeStructureIcon />}
              shortcut={shortcut("panel.left")}
              open={leftOpen}
              onOpenChange={setLeftOpen}
              width={leftWidth}
              onWidthChange={setLeftWidth}
            >
              <Outline
                docs={docs}
                layers={layers}
                openId={selected?.id ?? null}
                selection={selection}
                onOpen={openDocument}
                onSelectLayer={(docId, layerId) => (openDocument(docId), selectLayer(layerId))}
              />
            </SidePanel>
            <main className="min-w-0 flex-1 overflow-auto" onClick={(e) => {
                // Empty canvas: not on an item, and not a portal (popover) opened from one.
                const el = e.target as HTMLElement
                if (e.currentTarget.contains(el) && !el.closest("[data-selectable]")) clearSelection()
              }}
            >
              <DocumentView doc={selected} layers={layers} set={set} gesture={gesture} />
            </main>
            <SidePanel
              side="right"
              title="Inspector"
              icon={<Icons.SlidersHorizontalIcon />}
              shortcut={shortcut("panel.right")}
              open={rightOpen}
              onOpenChange={setRightOpen}
              width={rightWidth}
              onWidthChange={setRightWidth}
            >
              <Inspector
                doc={selected}
                layers={layers}
                selection={selection}
                schema={schema}
                history={history}
                set={set}
                gesture={gesture}
                reset={resetKeys}
              />
            </SidePanel>
          </div>
          <StatusBar>
            <StatusItem label="Documents">{docs.length}</StatusItem>
            <StatusItem label="History">
              {done} of {total}
            </StatusItem>
            <StatusItem label="Selection">{selectionPath(selection, selected, layers)}</StatusItem>
            <StatusSpacer />
            {error && <span className="truncate text-destructive">{error}</span>}
          </StatusBar>
        </div>
        {/* Bottom-right, above the 24px status bar. */}
        <SnackbarViewport className="fixed right-3 bottom-9 left-auto" />
      </SnackbarProvider>
    </TooltipProvider>
  )
}
