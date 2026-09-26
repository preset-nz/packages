import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { registerBuiltinRenderers } from "../../src"
import { registerCustomKinds } from "./custom-kinds"
import { App } from "./App"
import "./index.css"

registerBuiltinRenderers()
registerCustomKinds()

// Follow the OS appearance. No toggle: this is a playground, not an app.
const dark = window.matchMedia("(prefers-color-scheme: dark)")
const applyTheme = () =>
  document.documentElement.classList.toggle("dark", dark.matches)
applyTheme()
dark.addEventListener("change", applyTheme)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
