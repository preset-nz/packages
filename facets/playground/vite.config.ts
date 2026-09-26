import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import license from "rollup-plugin-license"
import { defineConfig } from "vite"

// Permissive licences only. A bundled module under anything else fails the
// build rather than shipping unnoticed.
const ALLOWED = "(MIT OR ISC OR BSD-2-Clause OR BSD-3-Clause OR Apache-2.0 OR 0BSD)"

// Fonts and CSS arrive through Tailwind, which the licence plugin never sees,
// so their notices are appended by hand. src/components/ui is adapted from
// shadcn/ui. Add a line here when adding a font or a CSS import.
const CSS_ONLY: Array<[name: string, licence: string, file: string]> = [
  ["@fontsource-variable/geist", "OFL-1.1", "LICENSE"],
  ["@fontsource-variable/jetbrains-mono", "OFL-1.1", "LICENSE"],
  ["tailwindcss", "MIT", "LICENSE"],
  ["tw-animate-css", "MIT", "LICENSE"],
  ["shadcn", "MIT", "LICENSE.md"],
]

const cssNotices = () =>
  CSS_ONLY.map(([name, licence, file]) => {
    const text = readFileSync(
      fileURLToPath(new URL(`./node_modules/${name}/${file}`, import.meta.url)),
      "utf8",
    )
    return `Name: ${name}\nLicense: ${licence}\n\n${text.trim()}`
  }).join("\n\n---\n\n")

// The playground imports the package source from ../src, unbuilt, exactly as a
// consumer would through node_modules. `dedupe` makes ../src resolve React from
// here: the package itself deliberately has no React installed.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    license({
      thirdParty: {
        includePrivate: false,
        allow: { test: ALLOWED, failOnUnlicensed: true, failOnViolation: true },
        output: {
          file: fileURLToPath(new URL("./dist/licenses.txt", import.meta.url)),
          template: (deps) =>
            [
              "Third-party software in facets.preset.nz",
              "",
              ...deps.map(
                (d) =>
                  `Name: ${d.name}\nVersion: ${d.version}\nLicense: ${d.license}\n\n${(d.licenseText ?? "").trim()}`,
              ),
              cssNotices(),
            ].join("\n\n---\n\n"),
        },
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
})
