// The Tauri-free half of the file drop hookup: where a drop landed and what to tell the field.
// `drop.ts` feeds it Tauri's drag-drop events; the tests feed it plain objects.

/**
 * The DOM event a path field receives when a file is dropped on it: a `CustomEvent` with
 * `detail: { path }`. The same string is ux-kit's `PATH_DROP_EVENT`; app-kit/core cannot import
 * ux-kit (an optional peer), so the contract is the string and a facets test pins the two together.
 */
export const PATH_DROP_EVENT = "path-drop"

/** Set (empty value) on a path field while a drag is over it, removed on leave, drop or cancel. Same as ux-kit's `PATH_DROP_TARGET_ATTRIBUTE`. */
export const PATH_DROP_TARGET_ATTRIBUTE = "data-drop-target"

/** Same as the `data-slot` ux-kit's `PathField` renders on its root. */
export const PATH_FIELD_SELECTOR = '[data-slot="path-field"]'

export interface PathDropDetail {
  path: string
}

/** Tauri's webview drag-drop payload, as far as this needs it. `position` is typed physical but see `positionScale`. */
export type DropPayload =
  | { type: "enter"; paths: string[]; position: { x: number; y: number } }
  | { type: "over"; position: { x: number; y: number } }
  | { type: "drop"; paths: string[]; position: { x: number; y: number } }
  | { type: "leave" }

/**
 * What to divide Tauri's drop position by to get CSS pixels. Tauri types the position as physical
 * but does not convert it (checked in wry 0.57, tauri-runtime-wry 2.12): on Windows it is physical
 * pixels, so divide by the device pixel ratio; on macOS (view points) and Linux (GTK widget
 * coordinates) it is already logical, and dividing would put the drop in the wrong place on a
 * Retina screen.
 */
export function positionScale(userAgent: string, devicePixelRatio: number): number {
  return /Windows/i.test(userAgent) && devicePixelRatio > 0 ? devicePixelRatio : 1
}

/** A drop position in CSS pixels, which is what `elementFromPoint` takes. `scale` is `positionScale`'s. */
export function toCssPoint(
  position: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  const divisor = scale > 0 ? scale : 1
  return { x: position.x / divisor, y: position.y / divisor }
}

/** The path field under a CSS-pixel point: the nearest `[data-slot="path-field"]` above the element there, or null. */
export function pathFieldAt(doc: Document, x: number, y: number): Element | null {
  return doc.elementFromPoint(x, y)?.closest(PATH_FIELD_SELECTOR) ?? null
}

/**
 * Turns drag-drop payloads into the DOM contract: the field under the pointer carries
 * `data-drop-target` while a drag is over it, and gets a `path-drop` event on drop.
 * Only the first dropped path counts. A drop anywhere else does nothing.
 */
export function createDropHandler(doc: Document, scale: () => number) {
  let target: Element | null = null

  const setTarget = (next: Element | null) => {
    if (next === target) return
    target?.removeAttribute(PATH_DROP_TARGET_ATTRIBUTE)
    next?.setAttribute(PATH_DROP_TARGET_ATTRIBUTE, "")
    target = next
  }
  const fieldAt = (position: { x: number; y: number }) => {
    const { x, y } = toCssPoint(position, scale())
    return pathFieldAt(doc, x, y)
  }

  return (payload: DropPayload) => {
    switch (payload.type) {
      case "enter":
      case "over":
        setTarget(fieldAt(payload.position))
        return
      case "leave":
        setTarget(null)
        return
      case "drop": {
        const field = fieldAt(payload.position)
        setTarget(null)
        const path = payload.paths[0]
        if (field && path) {
          field.dispatchEvent(
            new CustomEvent<PathDropDetail>(PATH_DROP_EVENT, { detail: { path }, bubbles: false }),
          )
        }
        return
      }
    }
  }
}
