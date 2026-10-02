# @preset.nz/ux-kit

One look and one way of working for the preset.nz desktop apps: tokens, palettes, fonts and Base UI primitives, in the studio's colours.

**Status:** skeleton. Private, version 0.0.1, not published. The plan lives in the guidance repo under `projects/ux-kit/`.

## What is in it

- `src/index.css`: the colour variables (light and dark), the type scale and the font imports.
- `src/components/`: button, checkbox, input, label, select and separator, on Base UI.
- `src/icons.ts`: Phosphor, the kit's icon set.
- `playground/`: a Tauri and React app that shows the kit. It is the only place that touches rhizome; the kit does not depend on it.

Like [facets](../facets), the kit ships unbuilt TypeScript. The consumer's Vite compiles it.

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
