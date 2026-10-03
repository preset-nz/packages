import { getCurrentWindow } from "@tauri-apps/api/window"
import { SettingsWindow, usePreferencesBootstrap } from "@preset.nz/preferences"

import { Gallery } from "./Gallery"
import { MainApp } from "./app/MainApp"
import { useTheme } from "./theme"

// One frontend, three windows. Rust opens Gallery and Settings with `?window=<label>`;
// the main window has no query.
// The Settings window is rendered from the schema in src-tauri/src/prefs.rs through
// @preset.nz/preferences; it is a native window, so the modal shell is always open and its
// close (Escape) closes the window.
function Settings() {
  useTheme()
  usePreferencesBootstrap()
  return (
    <SettingsWindow
      open
      onOpenChange={(open) => {
        if (!open) void getCurrentWindow().close()
      }}
      title="Settings"
    />
  )
}

export function App() {
  const which = new URLSearchParams(window.location.search).get("window")
  if (which === "gallery") return <Gallery />
  if (which === "settings") return <Settings />
  return <MainApp />
}
