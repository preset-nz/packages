# @preset.nz/ux-kit

One look and one way of working for the preset.nz desktop apps: tokens, palettes, fonts and Base UI primitives, in the studio's colours.

**Status:** skeleton. Private, version 0.0.1, not published. The plan lives in the guidance repo under `projects/ux-kit/`.

## What is in it

- `src/index.css`: the colour variables (light and dark), the type scale and the font imports.
- `src/components/`: one module per primitive, on Base UI where Base UI has the part, plain React and Tailwind where it does not. See the table below.
- `src/icons.ts`: Phosphor, the kit's icon set.
- `playground/`: a Tauri and React app that shows the kit. It is the only place that touches rhizome; the kit does not depend on it.

Like [facets](../facets), the kit ships unbuilt TypeScript. The consumer's Vite compiles it.

## Components

Union of the `src/components/ui` folders in Strata, Oblique, Shard and Map & Territory (Fault has none). Where several apps had the same component, the richest variant was taken. All are exported from the package index.

| Component | In kit | Came from | Notes |
|---|---|---|---|
| button | yes | Strata, Shard, M&T | Base UI Button |
| checkbox | yes | Strata, Oblique, Shard | |
| input | yes | all four | |
| label | yes | Strata, Oblique, Shard | |
| select | yes | Strata, Oblique, Shard | |
| separator | yes | all four | |
| dialog | yes | Oblique, Shard, M&T | Shard's themed variant. `render={<Button />}` replaces `asChild` |
| sheet | yes | M&T | Base UI Dialog docked to an edge (`side`) |
| popover | yes | Oblique | `PopoverAnchor` dropped: Base UI anchors through the Positioner's `anchor` prop |
| tooltip | yes | Oblique, M&T | `TooltipProvider delay` replaces `delayDuration` |
| tabs | yes | Oblique | `TabsTrigger` / `TabsContent` wrap Base UI `Tab` / `Panel`. Orientation uses `data-[orientation=...]` |
| toggle | yes | Oblique | `data-pressed` replaces `data-[state=on]` |
| toggle-group | yes | Oblique | Base UI `value` is always an array and `multiple` replaces `type="single" \| "multiple"` |
| slider | yes | Oblique, Shard, M&T | Takes a number or an array; one thumb per value |
| dropdown-menu | yes | Shard, M&T | M&T's fuller variant. `DropdownMenuLabel` is Base UI's `GroupLabel`, so it must sit inside a `DropdownMenuGroup` |
| context-menu | yes | Shard | Same shape as dropdown-menu, same `Label` caveat |
| navigation-menu | yes | M&T | Always the shared-viewport form. Radix's `NavigationMenuIndicator` and the `viewport={false}` mode are gone |
| sonner | yes | Oblique | Third-party, not Base UI. Theme is a `theme` prop (next-themes dropped). Also re-exports `toast` |
| snackbar | yes | Strata | Base UI Toast, with `useSnackbar`. **Both sonner and snackbar kept, pick one** |
| avatar | yes | M&T | Base UI Avatar |
| badge | yes | M&T | Plain, `render` prop replaces `asChild` |
| breadcrumb | yes | M&T | Plain `<a>`, no `next/link`. Use `render` for a router link |
| card | yes | M&T | Plain |
| skeleton | yes | M&T | Plain |
| textarea | yes | M&T | Plain, restyled to match Input |
| sidebar | yes | M&T | Plain, 700 lines. `asChild` became `render`. `useIsMobile` moved into the kit. Untested beyond the `collapsible="none"` form in the playground |
| toolbar | yes | Oblique, M&T | Base UI Toolbar (roving focus). `ToolbarItems` takes `groups` of `ToolbarItemSpec` (id, label, icon, shortcut, enabled, disabledReason, pressed, menu) and `onCommand(id)`; Oblique's `ToolButtonSpec` table with M&T's disabled reason. Disabled items stay focusable so the tooltip can say why. `ToolbarButton`, `ToolbarGroup`, `ToolbarSeparator`, `ToolbarSpacer` compose by hand. Shard's header buttons are inline JSX and Fault's are not a toolbar, so neither contributed |
| color-field | yes | M&T, Oblique, Strata | Swatch, hex text (commits on blur or Enter, bad input reverts), optional alpha (`#rrggbbaa`), preset grid in a Popover, native picker with `onPickStart`/`onPickEnd` for undo transactions (Oblique), `clearable` and null value (Strata, Oblique's optional colour), read-only, `trailing` slot for an eyedropper |
| color-swatch | yes | Strata, M&T, Oblique | Chip over a checkerboard; `null` is the dashed empty chip |
| side-panel | yes | Strata, M&T | Docked panel, props only (`open`, `width` owned by the app). Collapsed it leaves an icon rail that reopens it; the inner edge resizes by pointer drag (pointer capture) or arrow keys, clamped by `clampWidth`. `SidePanelHeader`, `SidePanelContent`. Strata's `SidePanel` ideas; persistence stays app-side |
| status-bar | yes | Oblique, Strata, M&T | `StatusBar`, `StatusItem` (optional label), `StatusSpacer`. Contents stay app-side |
| empty-state | yes | new | Icon, title, description, action slot |

M&T's `src/palettes/` (presets and derivation) was considered for the colour field and left out: it is map domain data and stays in the app, which passes its colours in through `presets`.

## Using it

```css
@import "tailwindcss";
@source "../node_modules/@preset.nz/ux-kit/src";
@import "@preset.nz/ux-kit/index.css";
```

```ts
// vite.config.ts
resolve: { dedupe: ["react", "react-dom", "@tauri-apps/api", "@preset.nz/ux-kit"] }
```

Without the `@source` line the build passes and the components render unstyled, because Tailwind does not scan `node_modules`. React 19 is a peer.

## Working on it

```sh
just install   # pnpm install
just dev       # the playground as a desktop app
just check     # typecheck and lint the kit and playground, cargo check
```

MIT.
