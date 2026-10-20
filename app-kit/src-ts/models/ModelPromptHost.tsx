import { DownloadPrompt, formatBytes } from "@preset.nz/ux-kit"
import { useEffect, useSyncExternalStore } from "react"

import type { ModelsApi } from "./api"
import { useModelsContext } from "./context"
import { useModels } from "./useModels"

type PromptState = "ask" | "downloading" | "failed"

/**
 * Renders the prompt `ensure` opens. Mount it once near the app root. The state comes from the
 * model's status: not Ready and not asked is "ask"; asked and downloading is the bar; asked and
 * failed is the reason with Retry; Ready resolves the `ensure`.
 */
export function ModelPromptHost({ api }: { api?: ModelsApi }) {
  const { gate, api: contextApi } = useModelsContext()
  const request = useSyncExternalStore(gate.subscribe, gate.snapshot)
  const { models, download, cancel } = useModels(api ?? contextApi)
  const info = request ? models.find((m) => m.id === request.id) : undefined
  const ready = info?.status.kind === "ready"

  useEffect(() => {
    if (request && ready) gate.succeed()
  }, [request, ready, gate])

  let state: PromptState | null = null
  if (request && info && !ready) {
    const kind = info.status.kind
    if (kind === "downloading") state = "downloading"
    else if (!request.asked) state = "ask"
    else state = kind === "failed" ? "failed" : "downloading"
  }

  const start = () => {
    if (!request) return
    gate.markAsked()
    void download(request.id)
  }
  const decline = () => gate.decline()
  const stop = () => {
    if (request) void cancel(request.id)
    gate.decline()
  }

  const status = info?.status
  return (
    <DownloadPrompt
      state={state}
      title={`${request?.tool ?? "This tool"} needs the ${info?.label ?? ""} model.`}
      name={info?.label ?? ""}
      facts={{
        size: info && info.totalBytes > 0 ? formatBytes(info.totalBytes) : undefined,
        licence: info?.licence || undefined,
        host: info?.host || undefined,
      }}
      progress={
        status?.kind === "downloading" && status.total > 0
          ? { done: status.done, total: status.total }
          : undefined
      }
      reason={status?.kind === "failed" ? status.reason : undefined}
      onDownload={start}
      onDismiss={decline}
      onCancel={stop}
      onRetry={start}
    />
  )
}
