#!/usr/bin/env node
/**
 * Licence gate, copied from Oblique. Fails `just check` when any installed npm
 * package, in the package or the playground, carries a licence outside the
 * permissive allowlist. No copyleft anywhere in the tree, so publishing and
 * sharing stay free of obligations beyond attribution.
 *
 * Policy: guidance/runbooks/project-visibility-and-licensing.md.
 */
import { execFileSync } from "node:child_process"

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Zlib",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Python-2.0",
  "OFL-1.1", // fonts only
  "CC-BY-4.0", // data/docs assets only (caniuse-lite)
])

/** Reviewed per-package exceptions. Key = package name, value = the reason. */
const EXCEPTIONS = new Map([
  // MPL-2.0, file-level copyleft: build-time CSS tooling under Tailwind 4,
  // used unmodified, never shipped in the site. Reviewed 2026-09-26, as Oblique.
  ["lightningcss", "MPL-2.0 — build-time only, unmodified"],
  ["lightningcss-darwin-arm64", "MPL-2.0 — build-time only, unmodified"],
])

/** SPDX expression check: OR passes if any branch passes; AND needs all. */
function licenceAllowed(expr) {
  const stripped = expr.replaceAll("(", " ").replaceAll(")", " ").trim()
  if (/\bOR\b/.test(stripped)) {
    return stripped.split(/\bOR\b/).some((part) => licenceAllowed(part.trim()))
  }
  if (/\bAND\b/.test(stripped)) {
    return stripped.split(/\bAND\b/).every((part) => licenceAllowed(part.trim()))
  }
  return ALLOWED.has(stripped)
}

const raw = execFileSync("pnpm", ["licenses", "list", "--json", "--prod=false", "--recursive"], {
  encoding: "utf8",
})
const byLicence = JSON.parse(raw)

const violations = []
for (const [licence, packages] of Object.entries(byLicence)) {
  if (licenceAllowed(licence)) continue
  for (const pkg of packages) {
    if (EXCEPTIONS.has(pkg.name)) continue
    violations.push(`  ${pkg.name} — ${licence}`)
  }
}

if (violations.length > 0) {
  console.error("Licence gate: disallowed licences in the npm tree:")
  console.error(violations.join("\n"))
  console.error("\nPolicy: guidance/runbooks/project-visibility-and-licensing.md (permissive-only).")
  process.exit(1)
}
console.log(`licence gate: ${Object.keys(byLicence).length} licence groups, all permissive ✔`)
