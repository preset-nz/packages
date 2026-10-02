import { Gallery } from "./Gallery"
import { MainApp } from "./app/MainApp"
import { Placeholder } from "./pages/Placeholder"
import { useTheme } from "./theme"

// One frontend, three windows. Rust opens Gallery and Settings with `?window=<label>`;
// the main window has no query.
function Settings() {
  useTheme()
  return (
    <main className="p-6">
      <Placeholder title="Settings" note="The Settings window, rendered from a schema through facets." />
    </main>
  )
}

export function App() {
  const which = new URLSearchParams(window.location.search).get("window")
  if (which === "gallery") return <Gallery />
  if (which === "settings") return <Settings />
  return <MainApp />
}
