import { useCallback, useEffect, useRef, useState } from "react"

import type { ModelChange, ModelInfo, ModelStatus, ModelsApi } from "./api"
import { useModelsContext } from "./context"

export interface UseModels {
  /** Declared models first, in registry order, then any other app's. Empty until the first read. */
  models: ModelInfo[]
  /** Starts the download. A refusal shows as the model's `failed` status, not a throw. */
  download(id: string): Promise<void>
  cancel(id: string): Promise<void>
  /** Rejects when Rust refuses (the model is downloading). */
  remove(id: string): Promise<void>
}

const reasonOf = (e: unknown): string => (typeof e === "string" ? e : (e as Error).message)

function withStatus(models: ModelInfo[], id: string, status: ModelStatus): ModelInfo[] {
  return models.map((m) => (m.id === id ? { ...m, status } : m))
}

/**
 * The model list, kept current by `app-kit://models`. The list is the only state: it is read on
 * mount, and every event replaces one row's status. A model that stops downloading, or one the
 * list doesn't know, is read again, so sizes and the apps using it stay true.
 */
export function useModels(api?: ModelsApi): UseModels {
  const context = useModelsContext()
  const backend = api ?? context.api
  const [models, setModels] = useState<ModelInfo[]>([])
  const loaded = useRef(false)
  const early = useRef(new Map<string, ModelStatus>())
  const current = useRef(models)
  current.current = models

  const refresh = useCallback(async () => {
    try {
      setModels(await backend.list())
    } catch {
      // Keep what is shown; the next event reads again.
    }
  }, [backend])

  useEffect(() => {
    loaded.current = false
    early.current.clear()
    let live = true
    const apply = (change: ModelChange) => {
      if (!loaded.current) {
        early.current.set(change.id, change.status)
        return
      }
      const known = current.current.some((m) => m.id === change.id)
      if (known) setModels((cur) => withStatus(cur, change.id, change.status))
      if (!known || change.status.kind !== "downloading") void refresh()
    }
    // Subscribe first, so a change during the first read isn't lost.
    const off = backend.subscribe(apply)
    backend.list().then(
      (list) => {
        if (!live) return
        loaded.current = true
        setModels(list.map((m) => ({ ...m, status: early.current.get(m.id) ?? m.status })))
        early.current.clear()
      },
      () => {},
    )
    return () => {
      live = false
      off()
    }
  }, [backend, refresh])

  const download = useCallback(
    async (id: string) => {
      const before = current.current.find((m) => m.id === id)
      if (before?.status.kind === "downloading") return
      // Show it downloading before the command returns: its events can only come after this, and a
      // quick failure then can't be overwritten by a stale row.
      setModels((cur) =>
        withStatus(cur, id, { kind: "downloading", done: 0, total: before?.totalBytes ?? 0 }),
      )
      try {
        await backend.download(id)
      } catch (e) {
        setModels((cur) => withStatus(cur, id, { kind: "failed", reason: reasonOf(e) }))
      }
    },
    [backend],
  )

  const cancel = useCallback((id: string) => backend.cancel(id).catch(() => {}), [backend])

  const remove = useCallback(
    async (id: string) => {
      await backend.remove(id)
      await refresh()
    },
    [backend, refresh],
  )

  return { models, download, cancel, remove }
}
