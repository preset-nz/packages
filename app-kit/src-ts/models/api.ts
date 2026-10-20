import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

// The one file in `models/` that touches Tauri. The hooks and components take a `ModelsApi`, so
// the ux-kit playground passes a fake and shows them without a window's backend.

/** Where a model stands, mirroring Rust's `ModelStatus` (`#[serde(tag = "kind")]`). */
export type ModelStatus =
  | { kind: "notInstalled" }
  | { kind: "downloading"; done: number; total: number }
  | { kind: "ready" }
  /** The manifest is there but a file is missing or the wrong size. */
  | { kind: "damaged" }
  /** The last download ended in this one plain line. */
  | { kind: "failed"; reason: string }

/** One model as `app_kit_models_list` reports it (Rust's `ModelInfo`, camelCase). */
export interface ModelInfo {
  id: string
  label: string
  /** The apps using it, as names; empty for a model this app never declared. */
  usedBy: string
  licence: string
  host: string
  status: ModelStatus
  bytesOnDisk: number
  totalBytes: number
  /** Other apps that use the model, by name. */
  otherApps: string[]
}

/** The payload of the `app-kit://models` event (Rust's `ModelChange`). */
export interface ModelChange {
  id: string
  status: ModelStatus
}

/** What the models hooks and components need from the backend. */
export interface ModelsApi {
  list(): Promise<ModelInfo[]>
  /** Starts the download and returns at once; progress arrives through `subscribe`. */
  download(id: string): Promise<void>
  cancel(id: string): Promise<void>
  remove(id: string): Promise<void>
  /** Calls `onChange` for every change. Returns the unsubscribe function. */
  subscribe(onChange: (change: ModelChange) => void): () => void
}

/** The real thing: the five `app_kit_models_*` commands and the `app-kit://models` event. */
export const tauriModelsApi: ModelsApi = {
  list: () => invoke<ModelInfo[]>("app_kit_models_list"),
  download: (id) => invoke<void>("app_kit_models_download", { id }),
  cancel: (id) => invoke<void>("app_kit_models_cancel", { id }),
  remove: (id) => invoke<void>("app_kit_models_remove", { id }),
  subscribe(onChange) {
    const un = listen<ModelChange>("app-kit://models", (e) => onChange(e.payload))
    return () => {
      un.then((f) => f())
    }
  },
}
