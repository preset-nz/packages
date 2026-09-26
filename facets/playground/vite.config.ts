import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"

// The package's schema file, served at its public URL in dev and emitted
// unhashed into the build. One source: ../schema.
const SCHEMA = fileURLToPath(new URL("../schema/v0.1.json", import.meta.url))
const schemaFile = (): Plugin => ({
  name: "facets-schema",
  configureServer(server) {
    server.middlewares.use("/schema/v0.1.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json")
      res.end(readFileSync(SCHEMA, "utf8"))
    })
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "schema/v0.1.json", source: readFileSync(SCHEMA, "utf8") })
  },
})

// The playground imports the package source from ../src, unbuilt, exactly as a
// consumer would through node_modules. `dedupe` makes ../src resolve React from
// here: the package itself deliberately has no React installed.
export default defineConfig({
  plugins: [react(), tailwindcss(), schemaFile()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
})
