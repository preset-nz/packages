import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { installPathDrop, nativeContextMenu } from "@preset.nz/app-kit"
import { App } from "./App"

nativeContextMenu()
void installPathDrop()

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
