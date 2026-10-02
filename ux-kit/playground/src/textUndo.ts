import { useEffect } from "react"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { useTextFocus } from "@preset.nz/ux-kit"

/**
 * Text fields keep their native typing undo. Edit > Undo/Redo are custom menu items, so
 * the menu would swallow Cmd+Z; instead, while a text field has focus:
 *   1. this hook reports `textFocus` (pass it to `useMenuSync`, which sends it in `menu_state`);
 *   2. Rust (menu.rs `sync_history`) shows plain "Undo"/"Redo" and, on select, emits
 *      `text-undo` ("undo" | "redo") to the focused window instead of touching the document;
 *   3. this hook runs `document.execCommand` on the focused field.
 * Fields commit on blur/Enter as one labelled edit, so the two undo scopes do not overlap.
 * execCommand is deprecated but is the only way to drive WebKit's field undo stack.
 * Copy this file and the textFocus branch in menu.rs.
 */
export function useTextUndo(): boolean {
  const textFocus = useTextFocus()
  useEffect(() => {
    const un = getCurrentWebviewWindow().listen<"undo" | "redo">("text-undo", (e) => {
      document.execCommand(e.payload)
    })
    return () => {
      un.then((f) => f())
    }
  }, [])
  return textFocus
}

/** Commit a focused field (its onBlur) before a document-level undo or redo from a button. */
export function blurField() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}
