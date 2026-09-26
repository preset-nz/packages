import Ajv, { type ErrorObject } from "ajv"
import schema from "../../schema/v0.1.json"

// The published schema, checked with the same validator as the package's
// drift check, so the two can't disagree. Results are warnings: the panel
// still renders anything structurally sound.
const check = new Ajv({ strict: true, allErrors: true }).compile(schema)

export function schemaWarnings(doc: unknown): string[] {
  if (check(doc)) return []
  const seen = new Set<string>()
  const all = check.errors ?? []
  const kept = all.filter(useful)
  return (kept.length ? kept : all.slice(0, 1))
    .map(describe)
    .filter((m) => !seen.has(m) && seen.add(m))
    .slice(0, 5)
}

// allErrors reports every branch it tried. Drop the bookkeeping: "must match
// then", "must match a schema in anyOf", and a row's type complaint (a row is
// read both as one field and as a pair). If nothing is left, the caller falls
// back to the first raw error.
function useful(e: ErrorObject): boolean {
  if (e.keyword === "if" || e.keyword === "anyOf") return false
  if (e.keyword === "type" && /\/rows\/\d+$/.test(e.instancePath)) return false
  return true
}

function describe(e: ErrorObject): string {
  const where = e.instancePath.replace(/\/(\d+)/g, "[$1]").replace(/\//g, ".").replace(/^\./, "") || "the schema"
  if (e.keyword === "additionalProperties") return `${where}: unknown prop "${e.params.additionalProperty}"`
  if (e.keyword === "required") return `${where}: missing "${e.params.missingProperty}"`
  return `${where}: ${e.message}`
}
