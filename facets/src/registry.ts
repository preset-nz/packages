import { schemaProblems } from "./pages"
import type { FieldRenderer, Scope } from "./types"

const scopes = new Map<string, Scope<unknown, Record<string, unknown>>>()
const fieldRenderers = new Map<string, FieldRenderer>()

/** Throws when the schema's pages don't add up: see `schemaProblems`. */
export function registerScope<S, V extends Record<string, unknown>>(
  key: string,
  scope: Scope<S, V>,
): void {
  const problems = schemaProblems(scope.schema)
  if (problems.length > 0) {
    throw new Error(`[properties] scope "${key}": ${problems.join("; ")}`)
  }
  scopes.set(key, scope as Scope<unknown, Record<string, unknown>>)
}

export function unregisterScope(key: string): void {
  scopes.delete(key)
}

export function getScope(key: string): Scope<unknown, Record<string, unknown>> | undefined {
  return scopes.get(key)
}

export function registerFieldRenderer(kind: string, Component: FieldRenderer): void {
  fieldRenderers.set(kind, Component)
}

export function getFieldRenderer(kind: string): FieldRenderer | undefined {
  return fieldRenderers.get(kind)
}
