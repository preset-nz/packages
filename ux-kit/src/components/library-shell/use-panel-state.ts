import { type Dispatch, type SetStateAction, useCallback } from "react"

import { clampWidth } from "../side-panel"

/** What a panel remembers between launches. */
export type PanelState = {
  width: number
  collapsed: boolean
}

export interface PanelBounds {
  min: number
  max: number
  /** The width a double-click on the resize edge restores. */
  default: number
}

/**
 * A side panel's geometry over state the app owns. The kit never stores it:
 * pass the pair a persisted store hands back (`usePersistedState`, a
 * zustand slice, plain `useState`). `setState` must accept an updater.
 *
 * `panelProps` spreads onto `SidePanel`. A width stored on a wider display, or
 * corrupt, is clamped on read, so it never escapes this display's bounds.
 */
export function usePanelState(
  [state, setState]: readonly [PanelState, Dispatch<SetStateAction<PanelState>>],
  bounds: PanelBounds,
) {
  const { min, max, default: defaultWidth } = bounds
  const width = clampWidth(state.width, min, max)
  const open = !state.collapsed
  const setWidth = useCallback(
    (next: number) => setState((p) => ({ ...p, width: next })),
    [setState],
  )
  const setOpen = useCallback(
    (next: boolean) => setState((p) => ({ ...p, collapsed: !next })),
    [setState],
  )
  const toggle = useCallback(() => setState((p) => ({ ...p, collapsed: !p.collapsed })), [setState])
  return {
    width,
    open,
    toggle,
    panelProps: {
      open,
      onOpenChange: setOpen,
      width,
      onWidthChange: setWidth,
      minWidth: min,
      maxWidth: max,
      defaultWidth,
    },
  }
}
