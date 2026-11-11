# @preset.nz/ux-kit

One look and one way of working for the preset.nz desktop apps: tokens, palettes, fonts and Base UI primitives, in the studio's colours.

Pre-1.0: a minor version can break things, a patch never does.

## What is in it

- `src/index.css`: the colour variables (light and dark), the type scale and the font imports. Besides the theme colours it defines `--channel-r`, `--channel-g` and `--channel-b`, the red, green and blue of an image's channels, which `Histogram` reads. They are not brand colours.
- `src/components/`: one module per primitive, on Base UI where Base UI has the part, plain React and Tailwind where it does not.
- `src/icons.ts`: Phosphor, the kit's icon set.
- `playground/`: a Tauri and React app that shows the kit. It is the only place that touches rhizome; the kit does not depend on it.

Like [facets](https://github.com/preset-nz/packages/tree/main/facets), the kit ships unbuilt TypeScript. The consumer's Vite compiles it.

## Components

Every component is exported from `src/index.ts`, which is the list. Each file's top comment says how it differs from shadcn and Radix. M&T's `src/palettes/` (presets and derivation) stays in the app, as map domain data; it passes its colours to the colour field through `presets`.

## Library shell

The frame of an image-library window, in the main export. The kit draws the shape; the app supplies the content, the strings and the persistence (it never stores anything).

| Export | Props worth knowing |
|---|---|
| `LibraryHeader` | The header strip: a panel toggle at each end, the app's title and a summary, a search field and the app's own actions. Strings come in as props, so the product name stays in the app's branding |
| `Rail`, `RailSection`, `RailRow`, `RailSort` | The left panel's body. `Rail` is the scrolling column (put it in a `SidePanel`). `RailSection` takes `id`, `title`, `collapsed`, `onToggle` and `summary` (shown while collapsed); the app persists `collapsed`. `RailRow` is a selectable row with a leading mark and a count. `RailSort` is a sort-key select with a direction toggle |
| `CardGrid` | A virtualised grid of equal cards: `items` (each with a `key`), `renderCell(item, index)` and `cellSize` in px. Only the rows in view are mounted |
| `LibraryStatusBar`, `CardSizeSlider` | The kit's `StatusBar` with the card-size slider at the right. The slider's range is `CARD_SIZE`; wire its value to `CardGrid`'s `cellSize` |
| `QuickView` | A near-fullscreen preview over the library, like Quick Look. `items`, `index`, `onClose`, `onIndexChange`, `title(item)` and `renderItem(item)`. Esc and Space close, Left and Right step |
| `usePanelState` | A side panel's width and collapsed flag over state you own: `usePanelState([state, setState], { min, max, default })`. The pair can come from `usePersistedState`. Spread the `panelProps` it returns onto `SidePanel` |

## Graphics

`@preset.nz/ux-kit/graphics` is a separate subpath for canvas drawing: `CurveEditor` and its edit helpers, the ADSR and levels curves, and `Histogram`.

`Histogram` takes `bins` (`{ luma?, r?, g?, b? }`, arrays of equal length, usually 256), `variant` (`"area"` or `"bars"`) and `scale` (`"linear"` or `"log"`; log keeps a clipped spike from flattening the rest). The red, green and blue traces use the `--channel-*` tokens.

```tsx
import { Histogram } from "@preset.nz/ux-kit/graphics"

<Histogram bins={{ r, g, b }} scale="log" aria-label="RGB histogram" />
```

## Using it

```sh
pnpm add @preset.nz/ux-kit
```

Then, in the app's CSS:

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

[facets](https://github.com/preset-nz/packages/tree/main/facets) 0.3 draws its number, slider and colour fields with the host app's components. An app on the kit re-exports them, for example `export { NumberField } from "@preset.nz/ux-kit"` in `src/components/ui/number-field.tsx`.

## Chat

`@preset.nz/ux-kit/chat` is a separate subpath, so apps without chat don't pull in streamdown. It is presentational: props in, callbacks out, no Tauri, no events, no model or fetch code. The host owns the messages and appends text deltas to the last one.

```tsx
import { ChatMarkdown, ChatMessage, ChatMessageContent, ChatScroller, ChatScrollerItem, PromptInput } from "@preset.nz/ux-kit/chat"
```

Add streamdown's classes to the app's CSS, next to the kit's `@source` line:

```css
@source "../node_modules/streamdown/dist/*.js";
```

| Export | Props worth knowing |
|---|---|
| `ChatScroller`, `ChatScrollerItem` | The scrolling list. It follows a streamed reply and stops following when the person scrolls up; a jump-to-latest button appears. `autoScroll`, `defaultScrollPosition`, `scrollButton`. Give an item `scrollAnchor` (on a user turn) to pin the view to it. Fills its parent, so give the parent a height. Built on `@shadcn/react/message-scroller` |
| `ChatMessage`, `ChatMessageContent` | `from: "user" \| "assistant"`. A user turn is a right-hand bubble |
| `ChatMarkdown` | Streamdown core: `children` is the text so far, `isAnimating` while it arrives. No code highlighting, diagrams or maths |
| `ToolCall`, `ToolCallHeader`, `ToolCallContent`, `ToolCallInput`, `ToolCallOutput` | A collapsible row. Header takes `name` and `state: "running" \| "done" \| "refused"`; input and output show JSON or text; `errorText` replaces the output |
| `Reasoning`, `ReasoningTrigger`, `ReasoningContent` | A folded "Thinking…" block. `isStreaming` opens it and folds it a second after it ends; `duration` is measured if not given; `open` / `defaultOpen` / `onOpenChange` for host control |
| `Suggestions`, `Suggestion` | Starter prompts: `suggestion` text, `onClick(text)` |
| `PromptInput` | `onSubmit(text)`, `onStop`, `status: "idle" \| "streaming" \| "stopped" \| "error"` (send becomes stop while streaming), `value` / `onValueChange` (optional, so a suggestion can fill it), `tools` (the toolbar slot, for example a `ToggleGroup`), `disabled`, `placeholder`. Enter sends, Shift+Enter breaks the line |
| `ChatRole`, `ToolCallState`, `ChatStatus` | The small types the above share |

The components are adapted from Vercel AI Elements (Apache-2.0) and shadcn/ui's MessageScroller (MIT). See `THIRD_PARTY_NOTICES.md`.

## Working on it

```sh
just install   # pnpm install, and the playground's crates
just dev       # the playground as a desktop app
just check     # the kit, the playground and cargo check
```

Run them in `ux-kit/` of [preset-nz/packages](https://github.com/preset-nz/packages). The playground links the other packages in that repo (rhizome, app-kit, preferences, facets, math), so a change to one of them that breaks it fails `just check`.

MIT.
