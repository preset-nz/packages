# Changelog

## 0.2.0 (unreleased, branch `host-fields`)

Breaking: the `number`, `vector`, `slider` and `color` renderers now draw with
your components, as `input`, `label`, `checkbox`, `select` and `separator`
already did. A panel looks and behaves like the rest of the app: a number you
drag, a square slider, your colour field.

### Migration

Hosts must provide three more modules at `@/components/ui/*`. If your app uses
ux-kit, each is a one-liner:

```ts
// src/components/ui/number-field.ts
export { NumberField } from "@preset.nz/ux-kit"
// src/components/ui/slider.ts
export { Slider } from "@preset.nz/ux-kit"
// src/components/ui/color-field.ts
export { ColorField } from "@preset.nz/ux-kit"
```

Other hosts: supply components with the props listed in the README's
"You supply the primitives". Until you do, the build fails on the missing
imports.

### Added

- `Scope.gesture` (`begin`, `end`, optional `cancel`) and the matching
  `onGestureBegin` / `onGestureEnd` / `onGestureCancel` renderer props, so a
  scrub, slider drag or colour pick is one undo step. Optional: without it
  drags are repeated `write`s, as before.

- `labelLayout` on `PropertyPanel`: `"auto"` (default, the layout as before),
  `"column"` (one shared label column per panel, controls on a common edge,
  numbers right-aligned with a muted unit) or `"stacked"` (every label above).
  `labelWidth` sets the column's width. Number fields gain `integer` and
  `suffix`; the host's `NumberField` may take optional `labelPlacement` and
  `suffix` props, which a host can ignore. Default output is unchanged.

### Changed

- `number` and `vector` edit through `NumberField`: the label is the scrub
  handle, typed input commits on blur or Enter, never per keystroke. A vector
  slot's `suffix` shows in read-only mode only. A missing number shows the
  field's `min` (or 0), not an empty box.
- `slider` uses `Slider`; `color` uses `ColorField` (swatch, hex, presets
  from the field's `presets`).
- `color` writes `""` where the host's field clears to `null`.
