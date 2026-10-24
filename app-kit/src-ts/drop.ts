import type { UnlistenFn } from "@tauri-apps/api/event"
import { getCurrentWebview } from "@tauri-apps/api/webview"

import { createDropHandler, positionScale } from "./drop-target"

let installed: Promise<UnlistenFn> | null = null

/**
 * Hook up dropping a file from Finder onto a path field. Call it once at startup; the window
 * needs `"dragDropEnabled": true` in `tauri.conf.json`, which is Tauri's default. Tauri reports
 * OS drops as webview drag-drop events (HTML5 drop events carry no real paths), so this hit-tests
 * the position to the `[data-slot="path-field"]` under the pointer, marks it `data-drop-target`
 * while a drag is over it and dispatches a `path-drop` event (`detail: { path }`, first file only)
 * on it when the file lands. ux-kit's `PathField` listens for that and commits like a pick.
 * A second call returns the same subscription. Resolves to the unlisten function.
 */
export function installPathDrop(): Promise<UnlistenFn> {
  if (installed) return installed
  const handle = createDropHandler(document, () =>
    positionScale(navigator.userAgent, window.devicePixelRatio),
  )
  const subscription = getCurrentWebview().onDragDropEvent((event) => handle(event.payload))
  installed = subscription.then(
    (unlisten) => () => {
      installed = null
      unlisten()
    },
    (error) => {
      installed = null
      throw error
    },
  )
  return installed
}
