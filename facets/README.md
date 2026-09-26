# @preset.nz/facets

Inspector panels for React, defined as data.

You describe a panel as a plain object — groups of fields, each with a kind and a
path. `facets` looks up a renderer per kind, reads the values, and draws the
panel. The panel itself knows nothing about your domain, so it never grows a
switch statement over your types.

```tsx
<PropertyPanel scopeKey={selection.kind} selection={selection} ctx={ctx} />
```

Built for image and map editors, where the same panel has to render a layer, a
filter, a document or a tool depending on what is selected.

---

## Installing

```sh
pnpm add @preset.nz/facets
```

React 19 is a peer dependency.

**This package ships unbuilt TypeScript.** There is no compiled output and no
build step — your bundler and `tsc` compile it along with your own source. That
is deliberate, and it is what makes the next section possible.

### You supply the primitives

The built-in renderers do not implement form controls. They import yours, from
the conventional shadcn path, and your bundler's `@` alias resolves it:

| Import | Must export |
|---|---|
| `@/components/ui/input` | `Input` |
| `@/components/ui/label` | `Label` |
| `@/components/ui/checkbox` | `Checkbox` |
| `@/components/ui/separator` | `Separator` |
| `@/components/ui/select` | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

So you need an `@/*` alias pointing at your `src/`, those five modules present,
and Tailwind with shadcn's theme tokens (`muted-foreground`, `border` and
friends are used throughout).

The panel's own layout (group headers, rows, help text) is Tailwind classes in
this package's source. Tailwind 4 does not scan `node_modules`, so name the
package in your CSS. From `src/index.css`:

```css
@import "tailwindcss";
@source "../node_modules/@preset.nz/facets/src";
```

Nothing fails when this line is missing. The build succeeds and the panel
renders unstyled.

The upside is that `facets` inherits whatever primitive library you already
chose — Base UI, Radix, or your own — instead of dragging in a second one and
making your panels look foreign inside your own app.

---

## A worked example

Register the built-in renderers once at startup, then register a scope per kind
of thing you can select.

```tsx
import {
  PropertyPanel,
  registerBuiltinRenderers,
  registerScope,
  type PropertySchema,
} from "@preset.nz/facets";

registerBuiltinRenderers();

const BLUR: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "blur",
      title: "Gaussian blur",
      rows: [
        { kind: "slider", id: "radius", label: "Radius", path: "radius", min: 0, max: 64, step: 1 },
        { kind: "checkbox", id: "clampEdges", label: "Clamp edges", path: "clampEdges" },
        [
          { kind: "color", id: "tint", label: "Tint", path: "tint" },
          { kind: "number", id: "amount", label: "Amount", path: "amount", min: 0, max: 1, step: 0.05 },
        ],
      ],
    },
  ],
};

registerScope("blur", {
  schema: BLUR,
  read: (sel: { id: string }, ctx) => ctx.getFilter(sel.id).params,
  write: (path, value, sel, ctx) => ctx.setFilterParam(sel.id, path, value),
});
```

Then mount one panel for everything:

```tsx
<PropertyPanel
  scopeKey={selection.kind}
  selection={selection}
  ctx={appApi}
  emptyState={<p>Nothing selected</p>}
/>
```

Select a blur and the blur panel appears. Add a new filter type later by
registering another scope — the panel does not change.

A row holding an array renders as a two-column grid. Everything else is full
width. That is the whole layout system, on purpose.

---

## The four pieces

**`FieldDef`** — one field, as data. `kind` picks the renderer, `path` picks the
value, `label` defaults to `id`.

**`Scope`** — a schema bundled with its own `read` and, optionally, `write`.
This is the important one. The panel never learns how to fetch or store your
values; each scope brings its own. Omit `write` and the scope is read-only.

```ts
interface Scope<S, V> {
  schema: PropertySchema;
  read: (selection: S, ctx: ScopeContext) => V;
  write?: (path: string, value: unknown, selection: S, ctx: ScopeContext) => void;
}
```

**The renderer registry** — `kind` to React component, open for extension.
Built-ins register through the same call you would use, with no special casing.

**`PropertyPanel`** — looks up the scope, calls `read`, walks the groups, hands
each field to its renderer. Props: `scopeKey`, `selection`, `ctx`, plus optional
`readOnly` and `emptyState`.

`ctx` is yours. The package treats it as opaque and passes it through to every
`read`, `write`, renderer and options provider. Put your app's API in it.

### How `path` resolves

`read()` returns a record, and `path` is a **key into that record** — a flat
lookup, not a nested traversal. Return a flat object shaped for the panel and
keep the mapping inside `read`, where your domain types are still in scope.

---

## Field kinds

Eleven ship built in: nine that hold a value, and two that only show something.

| Kind | Value | Notes |
|---|---|---|
| `text` | string | `placeholder` |
| `textarea` | string | `placeholder`, `rows` |
| `number` | number | `min`, `max`, `step` |
| `slider` | number | same, rendered as a slider |
| `checkbox` | boolean | |
| `select` | string | `options`, or `optionsProvider(ctx)` for dynamic lists |
| `color` | hex string | `presets`; shows a swatch |
| `vector` | number array | N scalars in one row — Houdini's `float3` / `int2`. `components` sets arity and per-slot label, suffix and range |
| `file` | `{ name }` | display only |
| `separator` | none | a horizontal rule. No `path` |
| `label` | none | static text: a hint or a sub-heading. The text is `label`. No `path` |

Groups take `collapsible: true` to fold under their title, and
`defaultCollapsed: true` to start folded. The open or closed state belongs to
the group, so it resets when the panel remounts.

---

## Read-only

Omit `write`, or pass `readOnly`, and no change handler reaches the renderers.
They then render the **formatted value as text**, not a disabled input. A
disabled `<input value="1024">` reads as broken; a plain `1024` reads as
information. Empty values render as an em dash.

Disabled controls are reserved for `disabledWhen`, which is a condition inside
an otherwise editable panel:

```ts
{ kind: "number", id: "radius", path: "radius",
  disabledWhen: { path: "mode", equals: "auto" } }
```

The condition reads one other field's value. Set one operator:

- `equals` / `notEquals` — compare against a single value.
- `in` / `notIn` — compare against a list, e.g. a param only some enum choices
  use: `disabledWhen: { path: "pattern", notIn: ["dashes", "stipple"] }`.

If several are set, the first in that order wins.

---

## Custom field kinds

Register any `kind` string and the panel will route to it. This is how a panel
grows a palette strip, a histogram or a segmentation preview without the package
knowing those exist.

```tsx
registerFieldRenderer("palette-swatches", ({ field, value, onChange, ctx }) => (
  <SwatchStrip colours={value as string[]} onPick={onChange} />
));
```

A field whose kind is not built in may carry any extra props it likes; the
renderer reads what it needs. **The type system will not check those props**, so
document them next to the renderer.

An unregistered kind logs a warning and renders nothing. It does not throw, and
it does not take the rest of the panel down with it.

---

## Notes

- **Registration is explicit.** `registerBuiltinRenderers()` is a call, not an
  import side effect, and the package declares `sideEffects: false`. Call it
  before rendering a panel.
- **Failures stay local.** A throwing `read` is caught and logged; an unknown
  scope renders `emptyState`; an unknown kind skips that field.
- **Schemas are serialisable.** Keep them that way — no closures in a
  `FieldDef` beyond `optionsProvider`. It keeps schemas versionable and lets them
  cross a plugin boundary later.

## Licence

MIT.
