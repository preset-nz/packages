import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// The package's tests. They live here because React does: the package itself
// deliberately installs none (see ../pnpm-workspace.yaml). They draw ../src
// with this playground's primitives, Base UI underneath, as a host would.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
})
