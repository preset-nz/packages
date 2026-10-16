import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { nativeContextMenu } from "@preset.nz/app-kit"
import { App } from "./App"

nativeContextMenu()

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
