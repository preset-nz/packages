// The native App menu's "Settings…" item (Cmd+,) arrives as one event. The
// Rust side emits it; this maps it to whatever opens the window. Until the
// shared native-menu package exists, each app builds the menu item by hand
// and emits this exact event name.

import { getCurrentWindow } from "@tauri-apps/api/window"

export const SETTINGS_MENU_EVENT = "menu://app/settings"

/** Listen for the menu item; returns a teardown. */
export function onSettingsMenu(open: () => void): () => void {
  const win = getCurrentWindow()
  let disposed = false
  let unlisten: (() => void) | null = null
  void win.listen(SETTINGS_MENU_EVENT, () => open()).then((fn) => {
    if (disposed) fn()
    else unlisten = fn
  })
  return () => {
    disposed = true
    unlisten?.()
  }
}
