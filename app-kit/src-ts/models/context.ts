import { createContext, createElement, type ReactNode, useContext, useMemo } from "react"

import { type ModelsApi, tauriModelsApi } from "./api"
import { ModelGate } from "./gate"

interface ModelsContextValue {
  api: ModelsApi
  gate: ModelGate
}

let defaultValue: ModelsContextValue | undefined

// Built on first use, so importing the module touches nothing.
function fallback(): ModelsContextValue {
  defaultValue ??= { api: tauriModelsApi, gate: new ModelGate(tauriModelsApi) }
  return defaultValue
}

const ModelsContext = createContext<ModelsContextValue | null>(null)

/**
 * Gives the models hooks and components another `api` (the playground's fake) and the gate that
 * goes with it. An app on the real backend doesn't need it.
 */
export function ModelsProvider({ api, children }: { api: ModelsApi; children: ReactNode }) {
  const value = useMemo(() => ({ api, gate: new ModelGate(api) }), [api])
  return createElement(ModelsContext.Provider, { value }, children)
}

export function useModelsContext(): ModelsContextValue {
  return useContext(ModelsContext) ?? fallback()
}
