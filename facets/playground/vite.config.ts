import { execFileSync } from "node:child_process"
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

// Which facets this playground draws with. It imports ../src, so it's the
// released version only if src/ and schema/ match that version's tag;
// otherwise it's that version plus unreleased changes (committed or not).
// Worked out once, at build or dev-server start.
const ROOT = fileURLToPath(new URL("..", import.meta.url))
function libVersion() {
  const version: string = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8")).version
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  try {
    const changed = git("diff", "--name-only", `v${version}`, "--", "src", "schema")
    const sha = git("rev-parse", "--short", "HEAD")
    const dirty = git("status", "--porcelain", "--", "src", "schema") !== ""
    return { version, released: changed === "", sha, dirty, changed: changed ? changed.split("\n").length : 0 }
  } catch {
    // No git, or no such tag: say so rather than claim a release.
    return { version, released: false, sha: null, dirty: false, changed: 0 }
  }
}

// The playground imports the package source from ../src, unbuilt, exactly as a
// consumer would through node_modules. `dedupe` makes ../src resolve React from
// here: the package itself deliberately has no React installed.
export default defineConfig({
  define: { __FACETS__: JSON.stringify(libVersion()) },
  plugins: [react(), tailwindcss(), schemaFile()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
})
