// The menu half of app-kit: commands, history, text-field undo, selection and stores, with
// no dependency on ux-kit. `index.ts` adds the toolbar bridge on top.
export {
  type Binding,
  bindCommands,
  type Command,
  type CommandSpec,
  useCommands,
  useCommandTable,
} from "./commands"
export { type DocumentState, useDocument, useDocumentNotes } from "./document"
export { installPathDrop } from "./drop"
export { type HistoryState, redo, undo, useHistory } from "./history"
export { nativeContextMenu } from "./nativeContextMenu"
export {
  type PathFieldMenuOptions,
  type PickFileOptions,
  type PickFilter,
  pathFieldMenu,
  pathsExist,
  pickFile,
  recentPaths,
  rememberPath,
  revealPath,
  useMissingCheck,
} from "./paths"
export {
  createMultiSelection,
  createSelection,
  insertIndex,
  type MultiSelection,
  type Selection,
} from "./selection"
export { createStore, type Store, useStore } from "./store"
export { blurField, isTextField, useTextFocus, useTextUndo } from "./text"
export { useMenuSync } from "./useMenuSync"
