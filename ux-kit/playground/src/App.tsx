import { ModelsProvider, ModelsSection } from "@preset.nz/app-kit/models"
import { registerFieldRenderer } from "@preset.nz/facets"
import { type ExtraGroup, SettingsWindow, usePreferencesBootstrap } from "@preset.nz/preferences"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MainApp } from "./app/MainApp"
import { Gallery } from "./Gallery"
import { createFakeModelsApi } from "./pages/fakeModels"
import { useTheme } from "./theme"

// One frontend, three windows. Rust opens Gallery and Settings with `?window=<label>`;
// the main window has no query.
// The Settings window is rendered from the schema in src-tauri/src/prefs.rs through
// @preset.nz/preferences, filling its native window; Escape closes it.
// Models in Settings (app-kit epic 06, story 05): one renderer kind and one extra group, on the
// fake models api. A real app passes no api and gets the Tauri commands.
const modelsApi = createFakeModelsApi()
registerFieldRenderer("models", () => <ModelsSection />)
const extraGroups: ExtraGroup[] = [
  {
    page: "general",
    group: { id: "models", title: "Models", rows: [{ kind: "models", id: "models" }] },
  },
]

function Settings() {
  useTheme()
  usePreferencesBootstrap()
  return (
    <ModelsProvider api={modelsApi}>
      <SettingsWindow
        onClose={() => void getCurrentWindow().close()}
        persistKey="playground.settings"
        extraGroups={extraGroups}
      />
    </ModelsProvider>
  )
}

export function App() {
  const which = new URLSearchParams(window.location.search).get("window")
  if (which === "gallery") return <Gallery />
  if (which === "settings") return <Settings />
  return <MainApp />
}
