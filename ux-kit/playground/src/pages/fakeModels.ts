import type { ModelChange, ModelInfo, ModelStatus, ModelsApi } from "@preset.nz/app-kit/models"

// A stand-in for app-kit's Tauri commands, so the Models page runs in the playground with real
// components. Downloads are timer-driven (about 3 s); the "Upscaler" fails once at 60%, so Retry
// has something to do; "Whisper tiny" is also used by Strata, so Remove names it.

const MB = 1_000_000

const seed = (): ModelInfo[] => [
  {
    id: "mobile_sam",
    label: "MobileSAM",
    usedBy: "Playground",
    licence: "Apache-2.0",
    host: "huggingface.co",
    status: { kind: "notInstalled" },
    bytesOnDisk: 0,
    totalBytes: 44.7 * MB,
    otherApps: [],
  },
  {
    id: "upscaler",
    label: "Upscaler",
    usedBy: "Playground",
    licence: "MIT",
    host: "huggingface.co",
    status: { kind: "notInstalled" },
    bytesOnDisk: 0,
    totalBytes: 67.2 * MB,
    otherApps: [],
  },
  {
    id: "whisper_tiny",
    label: "Whisper tiny",
    usedBy: "Playground, Strata",
    licence: "MIT",
    host: "huggingface.co",
    status: { kind: "ready" },
    bytesOnDisk: 75.5 * MB,
    totalBytes: 75.5 * MB,
    otherApps: ["Strata"],
  },
  {
    id: "depth_small",
    label: "Depth Anything small",
    usedBy: "Playground",
    licence: "Apache-2.0",
    host: "huggingface.co",
    status: { kind: "damaged" },
    bytesOnDisk: 12.3 * MB,
    totalBytes: 99.1 * MB,
    otherApps: [],
  },
]

/** A fresh fake: its own models, timers and listeners. `stop()` clears the timers. */
export function createFakeModelsApi(): ModelsApi & { stop(): void } {
  const models = seed()
  const listeners = new Set<(change: ModelChange) => void>()
  const timers = new Map<string, number>()
  const attempts = new Map<string, number>()

  const set = (id: string, status: ModelStatus) => {
    const m = models.find((x) => x.id === id)
    if (!m) return
    m.status = status
    if (status.kind === "ready") m.bytesOnDisk = m.totalBytes
    if (status.kind === "notInstalled") m.bytesOnDisk = 0
    for (const l of listeners) l({ id, status })
  }
  const clear = (id: string) => {
    window.clearInterval(timers.get(id))
    timers.delete(id)
  }

  return {
    list: async () => structuredClone(models),
    async download(id) {
      const m = models.find((x) => x.id === id)
      if (!m) throw `Unknown model ${id}`
      if (timers.has(id)) throw `${id} is downloading`
      const attempt = (attempts.get(id) ?? 0) + 1
      attempts.set(id, attempt)
      const failAt = id === "upscaler" && attempt === 1 ? 0.6 : 2
      let done = 0
      set(id, { kind: "downloading", done, total: m.totalBytes })
      timers.set(
        id,
        window.setInterval(() => {
          done = Math.min(m.totalBytes, done + m.totalBytes / 30)
          if (done >= m.totalBytes * failAt) {
            clear(id)
            set(id, { kind: "failed", reason: "The connection dropped." })
          } else if (done >= m.totalBytes) {
            clear(id)
            set(id, { kind: "ready" })
          } else {
            set(id, { kind: "downloading", done, total: m.totalBytes })
          }
        }, 100),
      )
    },
    async cancel(id) {
      if (!timers.has(id)) return
      clear(id)
      set(id, { kind: "notInstalled" })
    },
    async remove(id) {
      if (timers.has(id)) throw `${id} is downloading`
      set(id, { kind: "notInstalled" })
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    stop() {
      for (const id of [...timers.keys()]) clear(id)
    },
  }
}
