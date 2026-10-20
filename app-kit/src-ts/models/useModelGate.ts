import { useMemo } from "react"

import { useModelsContext } from "./context"
import type { EnsureOptions } from "./gate"

export { ModelDeclined } from "./gate"

export interface ModelGate {
  /**
   * Resolves when the model is Ready: at once if it is, otherwise after the person agrees and the
   * download ends. Rejects with `ModelDeclined` on Not now, Cancel or Close, which a tool treats
   * as "don't arm". A `<ModelPromptHost />` must be mounted for the prompt to show.
   */
  ensure(id: string, options?: EnsureOptions): Promise<void>
}

export function useModelGate(): ModelGate {
  const { gate } = useModelsContext()
  return useMemo(() => ({ ensure: gate.ensure }), [gate])
}
