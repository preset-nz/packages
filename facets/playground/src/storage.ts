// Last session, restored on load. Everything is wrapped: storage can be
// blocked, full, or hold something an older playground wrote.
const KEY = "facets-playground:v1"

export interface Saved {
  schemaText: string
  valueText: string
  readOnly: boolean
  starter: string
}

export function load(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Partial<Saved>) : {}
  } catch {
    return {}
  }
}

export function save(state: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Nothing to do: autosave is a convenience.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // As above.
  }
}
