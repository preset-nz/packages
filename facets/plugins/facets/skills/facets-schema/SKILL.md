---
name: facets-schema
description: Write and wire inspector panels with @preset.nz/facets, React panels defined as data. Use when a project depends on @preset.nz/facets, or when asked to add a property panel, an inspector, a settings panel or a field to one, to write a PropertySchema or a Scope, to register a custom field renderer, or to set a host app up for facets.
---

# facets: inspector panels as data

A panel is a `PropertySchema`: groups of rows of fields. Each field has a `kind` (which renderer draws it) and a `path` (which value it shows). A `Scope` bundles a schema with `read` and optional `write`. `<PropertyPanel>` looks up the scope and draws it. The package never learns the host's domain.

- JSON Schema: https://facets.preset.nz/schema/v0.1.json (also `@preset.nz/facets/schema/v0.1.json`)
- Playground to try a schema: https://facets.preset.nz
- Source: https://github.com/preset-nz/facets

## Before writing a schema

1. **Put the schema in its own JSON-shaped object** and validate it against the JSON Schema. Built-in kinds are strict there: a misspelt prop, a missing `path`, or a `path` on `separator`/`label` fails. A misspelt *kind* passes as a custom kind, so check each `kind` against the table below.
2. **Paths are flat keys.** `path: "transform.x"` looks up `values["transform.x"]`, not `values.transform.x`. Shape the record `read()` returns to fit the panel, and keep the domain mapping inside `read`/`write`.
3. **`id` is unique within the schema.** Usually the same string as `path`.

## Kinds

| kind | value at `path` | props |
|---|---|---|
| `text` | string | `placeholder` |
| `textarea` | string | `placeholder`, `rows` |
| `number` | number | `min`, `max`, `step` |
| `slider` | number | `min`, `max`, `step` |
| `select` | string (the option's `value`) | `options: [{ value, label }]`, or `optionsProvider(ctx)` in code |
| `color` | hex string | (`presets` is declared, not drawn) |
| `checkbox` | boolean | |
| `file` | `{ name }` | always read-only; picking a file is the host's job |
| `vector` | number[] | `components: [{ label, suffix, min, max, step }]` (required), `integer`, `precision` |
| `separator` | none; no `path` | `label` as an optional caption |
| `label` | none; no `path` | `label` (required) is the text |

Every kind takes `label` (defaults to `id`), `disabledWhen` and `promote`. Any other `kind` string is a custom kind (below).

**Rows:** a field is a full-width row; an array of fields is one row laid out as a grid, usually two. That is the whole layout system.

**Groups:** `{ id, title?, description?, collapsible?, defaultCollapsed?, rows }`. Collapsing needs a `title`.

**`disabledWhen`:** `{ path, equals | notEquals | in | notIn }`, one operator, reading one other field's value. Example: `{ path: "blend", notIn: ["multiply", "screen"] }`. Disabled means greyed out, not hidden.

**`title`** at the schema root (optional) names the scope, e.g. `"Filter"`. It heads the card view.

## Views and promotion

From 0.1.4. Check the installed version before using them: 0.1.3 ignores `promote` and `view`, so nothing fails and nothing shows.

One scope draws three ways. `<PropertyPanel view>` picks one:

| view | draws |
|---|---|
| `"inspector"` (default) | every group and field |
| `"card"` | fields whose `promote` has `"card"`, no group chrome, headed by the schema's `title` or the panel's `title` prop |
| `"collapsed"` | fields whose `promote` has `"collapsed"`, one compact row each: a scope folded shut |

`promote` lists the views a field shows in besides the inspector, like a parm promoted to a Houdini asset's interface:

```ts
{ kind: "slider", id: "master", path: "master", promote: ["card", "collapsed"] }
{ kind: "slider", id: "pan", path: "pan", promote: ["card"] }
{ kind: "select", id: "type", path: "type", options: TYPES, promote: ["collapsed"] }
```

- **The views are independent.** `["collapsed"]` does not put a field on the card. It's always a list, never a bare string.
- **Promote little.** A card is a node's face: its level, its source, what it is. Everything else stays in the inspector.
- **A closed collapsible group** shows its `"collapsed"` fields under its title.
- **Folding a whole scope is the host's job.** Draw the title bar and hold the open or closed state; render `view="collapsed"` when shut, `view="inspector"` when open.
- **`promotedFields(schema, view)`** returns what a view would draw, to skip an empty card.

## Scopes and the panel

```tsx
import { PropertyPanel, registerBuiltinRenderers, registerScope } from "@preset.nz/facets"

registerBuiltinRenderers() // once, at startup, before any custom renderers

registerScope("layer", {
  schema: LAYER_SCHEMA,
  read: (sel: { id: string }, ctx) => ctx.layerProps(sel.id),          // flat record keyed by path
  write: (path, value, sel, ctx) => ctx.setLayerProp(sel.id, path, value), // omit for read-only
})

<PropertyPanel scopeKey={selection.kind} selection={selection} ctx={appApi} emptyState={<p>Nothing selected</p>} />
```

- **`read` is memoised on `selection` identity.** Pass a new selection object when the values change; mutating in place shows stale values.
- **Read-only** (no `write`, or `readOnly` on the panel): renderers get no `onChange` and draw the value as plain text. Disabled controls are only for `disabledWhen`.
- **`ctx` is the host's.** The package passes it through untouched to `read`, `write`, renderers and `optionsProvider`.
- **Keep schemas serialisable.** No closures in a field except `optionsProvider`.

## Custom kinds and overrides

```tsx
import { registerFieldRenderer, type CustomFieldDef, type FieldRenderer } from "@preset.nz/facets"

/** Reads `colours: string[]`. Value: the chosen hex. */
const Swatches: FieldRenderer<CustomFieldDef> = ({ field, value, disabled, onChange }) =>
  onChange ? <Strip colours={field.colours as string[]} value={value} disabled={disabled} onPick={onChange} />
           : <span>{String(value ?? "—")}</span>

registerFieldRenderer("swatches", Swatches as FieldRenderer) // the cast is needed today
```

- **Document the extra props next to the renderer.** The type system doesn't check them.
- **Handle both modes.** With `onChange`, draw a control and honour `disabled`. Without it, draw the value as text.
- **`view` arrives as a prop.** In `"collapsed"` the renderer sits in a compact label-and-control row, so drop its own label line. Ignoring `view` is allowed. Don't spread the props onto a DOM element; React warns about `view`, `field` and `ctx`.
- **Override a built-in** by registering the same kind after `registerBuiltinRenderers()`; the last registration wins. This is how a host gets a colour picker instead of the built-in swatch and hex box.
- **An unregistered kind renders nothing** and logs `[properties] no renderer for kind`. It doesn't throw.
- Reading `field.label` on any field is safe: every kind keeps `label`. `path` is absent on `separator` and `label`, so narrow with `"path" in field` before reading it generically.

## Setting up a host app

facets ships unbuilt TypeScript that imports the host's shadcn primitives. All four steps are needed. The first three fail silently or late.

1. **Primitives** at `@/components/ui/*`, with the `@` alias pointing at `src/`: `input` (`Input`), `label` (`Label`), `checkbox` (`Checkbox`), `separator` (`Separator`), and `select` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`). Base UI or Radix both work.
2. **Tailwind 4 `@source`** in the CSS entry, relative to that file. Without it the build passes and the panel renders unstyled:
   ```css
   @import "tailwindcss";
   @source "../node_modules/@preset.nz/facets/src";
   ```
3. **Vite `resolve.dedupe`**, so the package and the app share one React and one registry:
   ```ts
   resolve: { dedupe: ["react", "react-dom", "@preset.nz/facets"] }
   ```
4. **`registerBuiltinRenderers()`** once at startup. The package is `sideEffects: false`; nothing registers on import.

## Checking your work

- Validate the schema object against https://facets.preset.nz/schema/v0.1.json.
- Paste it into https://facets.preset.nz to see it drawn, with warnings under the editor. The preview toggles inspector and card, and its title bar folds the scope.
- Grep the built CSS for a class only facets uses (`gap-x-3`, `min-h-8`) to confirm the `@source` line works.
