// The TypeScript half against the shared fixtures. They are generated from
// this code, so here they catch an accidental change; the Rust suite reads
// the same files to prove the two halves agree.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { Curve } from "../src-ts/index.ts"
import * as m from "../src-ts/index.ts"

const load = (f: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"))
const scalars = load("scalars.json") as {
  tolerance: number
  cases: { fn: keyof typeof m; args: number[]; expected: number }[]
}
const curves = load("curves.json") as {
  tolerance: number
  cases: {
    name: string
    curve: Curve
    samples: { x: number; y: number }[]
    envelope?: { t: number; release: number | null; y: number }[]
  }[]
}

describe("scalar fixtures", () => {
  for (const c of scalars.cases) {
    it(`${c.fn}(${c.args.join(", ")})`, () => {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: fixtures name the function to call, so lookup by key is the point
      const f = m[c.fn] as (...a: number[]) => number
      expect(Math.abs(f(...c.args) - c.expected)).toBeLessThanOrEqual(scalars.tolerance)
    })
  }
})

describe("curve fixtures", () => {
  for (const c of curves.cases) {
    it(c.name, () => {
      for (const s of c.samples) {
        expect(Math.abs(m.evaluate(c.curve, s.x) - s.y)).toBeLessThanOrEqual(curves.tolerance)
      }
      for (const e of c.envelope ?? []) {
        const y = m.evaluateEnvelope(c.curve, e.t, e.release ?? undefined)
        expect(Math.abs(y - e.y)).toBeLessThanOrEqual(curves.tolerance)
      }
    })
  }
})
