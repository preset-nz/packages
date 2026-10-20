import type { ModelsApi } from "./api"

/** `ensure` rejects with this when the person says no: Not now, Cancel or Close. */
export class ModelDeclined extends Error {
  modelId: string

  constructor(modelId: string) {
    super(`The ${modelId} model was declined`)
    this.name = "ModelDeclined"
    this.modelId = modelId
  }
}

export interface EnsureOptions {
  /** The tool that needs the model, for the prompt: "Smart Select". */
  for?: string
}

/** The request the prompt is showing. Replaced, never mutated, so React can compare it. */
export interface GateRequest {
  id: string
  tool: string | undefined
  /** The person pressed Download in this session. */
  asked: boolean
}

interface Waiting {
  request: GateRequest
  promise: Promise<void>
  resolve: () => void
  reject: (error: Error) => void
}

/**
 * The queue behind `useModelGate` and `ModelPromptHost`. It keeps only what has been asked for
 * and whether the person said yes; the prompt's state comes from the model's status.
 */
export class ModelGate {
  private api: ModelsApi
  private queue: Waiting[] = []
  private listeners = new Set<() => void>()
  private current: GateRequest | null = null

  constructor(api: ModelsApi) {
    this.api = api
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The request being shown, or null. */
  snapshot = (): GateRequest | null => this.current

  /** Resolves at once for a Ready model; otherwise queues the prompt. One prompt at a time. */
  ensure = async (id: string, options: EnsureOptions = {}): Promise<void> => {
    const models = await this.api.list()
    const info = models.find((m) => m.id === id)
    if (!info) throw new Error(`Unknown model ${id}`)
    if (info.status.kind === "ready") return
    const waiting = this.queue.find((w) => w.request.id === id)
    if (waiting) return waiting.promise
    let resolve!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.queue.push({
      request: { id, tool: options.for, asked: false },
      promise,
      resolve,
      reject,
    })
    this.publish()
    return promise
  }

  /** The person pressed Download (or Retry). */
  markAsked(): void {
    const head = this.queue[0]
    if (!head || head.request.asked) return
    head.request = { ...head.request, asked: true }
    this.publish()
  }

  /** The model is Ready: resolve the head and move to the next. */
  succeed(): void {
    const head = this.queue.shift()
    head?.resolve()
    this.publish()
  }

  /** The person said no: reject the head with `ModelDeclined` and move to the next. */
  decline(): void {
    const head = this.queue.shift()
    head?.reject(new ModelDeclined(head.request.id))
    this.publish()
  }

  private publish(): void {
    this.current = this.queue[0]?.request ?? null
    for (const l of this.listeners) l()
  }
}
