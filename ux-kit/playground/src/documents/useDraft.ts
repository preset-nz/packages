import { useEffect, useState } from "react"

/**
 * A field's local value while it is being edited. It follows the rhizome value whenever that
 * changes (selection, undo, redo), and lets the field show what is typed in between.
 */
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value)
  const key = JSON.stringify(value)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the serialised `value`, so the effect follows its content, not its identity
  useEffect(() => setDraft(value), [key])
  return [draft, setDraft] as const
}
