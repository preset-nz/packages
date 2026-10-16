// Set by vite.config.ts from package.json and git; see libVersion() there.
declare const __FACETS__: {
  version: string
  released: boolean
  sha: string | null
  dirty: boolean
  changed: number
}

export const FACETS = __FACETS__
