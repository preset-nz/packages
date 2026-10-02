import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // The kit is a path dependency of unbuilt TypeScript. Rollup resolves its
    // imports from its real location, so pin shared runtime to this app's copy.
    dedupe: [
      "react",
      "react-dom",
      "@tauri-apps/api",
      "@preset.nz/facets",
      "@preset.nz/ux-kit",
    ],
  },
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1431 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
