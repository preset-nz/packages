import { Button, ConfirmDialog, EmptyState, formatBytes, List, ListRow } from "@preset.nz/ux-kit"
import { useState } from "react"

import type { ModelInfo, ModelsApi } from "./api"
import { useModels } from "./useModels"

/** "Strata", "Strata and Shard", "Strata, Shard and Fault". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function sizeText(m: ModelInfo): string {
  switch (m.status.kind) {
    case "ready":
      return `${formatBytes(m.bytesOnDisk)} on disk`
    case "downloading":
      return `${formatBytes(m.status.done)} of ${formatBytes(m.status.total)}`
    case "damaged":
      return "Damaged"
    case "failed":
      return m.status.reason
    default:
      return formatBytes(m.totalBytes)
  }
}

const detailOf = (m: ModelInfo): string =>
  [m.usedBy, m.licence, sizeText(m)].filter(Boolean).join(" · ")

/**
 * The Settings section: one row per model with its status, and the action that fits it. Remove
 * asks first and names the other apps that use the model.
 */
export function ModelsSection({ api }: { api?: ModelsApi }) {
  const { models, download, cancel, remove } = useModels(api)
  const [removing, setRemoving] = useState<ModelInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = (m: ModelInfo) => {
    setError(null)
    setRemoving(m)
    setOpen(true)
  }

  const action = (m: ModelInfo) => {
    switch (m.status.kind) {
      case "ready":
        return (
          <Button size="sm" variant="outline" onClick={() => ask(m)}>
            Remove
          </Button>
        )
      case "downloading":
        return (
          <Button size="sm" variant="outline" onClick={() => void cancel(m.id)}>
            Cancel
          </Button>
        )
      case "damaged":
      case "failed":
        return (
          <Button size="sm" variant="outline" onClick={() => void download(m.id)}>
            Retry
          </Button>
        )
      default:
        return (
          <Button size="sm" variant="outline" onClick={() => void download(m.id)}>
            Download
          </Button>
        )
    }
  }

  const onDisk = models.reduce((sum, m) => sum + m.bytesOnDisk, 0)
  const others = removing?.otherApps ?? []

  return (
    <>
      <List
        aria-label="Models"
        empty={
          <EmptyState
            title="No models"
            description="A tool that needs a model asks before downloading it."
          />
        }
        footer={`${formatBytes(onDisk)} on disk`}
      >
        {models.map((m) => (
          <ListRow key={m.id} id={m.id} title={m.label} detail={detailOf(m)} trailing={action(m)} />
        ))}
      </List>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${removing?.label ?? ""}?`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove(removing.id)
          } catch (e) {
            setError(typeof e === "string" ? e : (e as Error).message)
            throw e
          }
        }}
      >
        <p>{removing ? `${formatBytes(removing.bytesOnDisk)}. ` : ""}You can download it again.</p>
        {others.length > 0 ? (
          <p>
            {joinNames(others)} {others.length === 1 ? "also uses" : "also use"} this model.
          </p>
        ) : null}
        {error ? <p>{error}</p> : null}
      </ConfirmDialog>
    </>
  )
}
