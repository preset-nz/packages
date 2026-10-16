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

The playground at [facets.preset.nz](https://facets.preset.nz) shows the field
kinds, the schema as JSON, and the panel it draws, side by side. Its source is
in `playground/`.

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
| `@/components/ui/number-field` | `NumberField` |
| `@/components/ui/slider` | `Slider` |
| `@/components/ui/color-field` | `ColorField` |

The last three are what make a panel feel like the rest of your app: a number
you drag, a square slider, your colour picker. They are the **minimum** facets
reads (typed in `dev/ui/` in this repo):

- `NumberField`: `value: number`, `onValueChange(value, { reason })`, `min`,
  `max`, `step`, `integer`, `precision`, `label` (the scrub handle: the field
  draws its own label, so the panel adds none), `disabled`, and
  `onScrubStart` / `onScrubEnd` / `onScrubCancel`. Facets uses it for `number`
  and for each slot of `vector`. A vector slot's `suffix` shows in read-only
  mode only, unless the panel sets `labelLayout` (below). Two **optional** props
  serve that: `labelPlacement` (`"inside"` default, `"column"`, `"above"`) and
  `suffix` (a muted unit inside the box). A host that ignores them keeps the
  label inside the box, so nothing doubles.
- `Slider`: `value: number`, `onValueChange(value)` (a number or an array, facets
  takes the first), `onValueCommitted()`, `min`, `max`, `step`, `disabled`,
  `aria-label`. One thumb.
- `ColorField`: `value: string | null`, `onChange(value | null)`, `label`,
  `presets`, `disabled`, `onPickStart` / `onPickEnd`. No `onChange` means
  read-only.

So you need an `@/*` alias pointing at your `src/`, those eight modules present,
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

Tell Vite to resolve one copy of React and of this package, so the package and
your app share one registry. In `vite.config.ts`:

```ts
resolve: {
  dedupe: ["react", "react-dom", "@preset.nz/facets"],
},
```

Without it, a linked or nested install can register renderers in one copy and
look them up in another.

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
width. That is the whole layout system, on purpose, with one switch: where the
labels go.

### Label layout

`labelLayout` on `PropertyPanel` (inspector and card views; collapsed ignores it):

| Value | Labels | Numbers |
|---|---|---|
| `"auto"` (default) | Above their control; a checkbox's beside it | The label is the scrub handle, inside the box |
| `"column"` | One shared column to the left, truncated with the full text as a tooltip; controls start on one edge | Label in the column (still the scrub handle), number right-aligned, `suffix` as a muted unit |
| `"stacked"` | All above their control | Label above the box, `suffix` as a unit |

In `"column"` the label column's width is one CSS variable on the panel root
(`--facets-label-w`), set from the longest label (8ch to 16ch) or from the
`labelWidth` prop. A vector keeps its axis labels inside its slots, so its
fields share the column the scalars start on. A paired row (`[a, b]`) draws one
field per row, and a slider shows its value to the right. A custom renderer
follows the layout by wrapping its control in `FieldShell` (the built-ins'
shell; `top` aligns the label with the top of a tall control, `above` keeps it
above in every layout) and a read-only value in `ReadOnlyText`. For anything
else, `useLabelLayout()` and `COLUMN_ROW` give the parts. A renderer that draws
its own label ignores the layout.

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
`readOnly`, `emptyState`, `view`, `title` (see [Views](#views-inspector-card-collapsed)),
`labelLayout` and `labelWidth` (see [Label layout](#label-layout)).

`ctx` is yours. The package treats it as opaque and passes it through to every
`read`, `write`, renderer and options provider. Put your app's API in it.

### Drags as one undo step

A scrubbed number, a dragged slider and an open colour picker produce many
`write`s. Say where they begin and end and your undo stack can fold them into
one step: add `gesture` to the scope.

```ts
registerScope("blur", {
  schema, read, write,
  gesture: {
    begin: (path, sel, ctx) => ctx.beginGesture(sel.id, path),
    end: (path, sel, ctx) => ctx.endGesture(),
    cancel: (path, sel, ctx) => ctx.cancelGesture(), // optional: Escape during a scrub
  },
})
```

Every `write` between `begin` and `end` belongs to the gesture (apply them
live, close one undo step at `end`). `cancel` fires instead of `end` when the
user abandons a scrub; put the value back. Typed values and arrow-key steps are
single writes outside any gesture. Omit `gesture` and drags are plain repeated
`write`s, as before. The renderers receive the same hooks as optional
`onGestureBegin` / `onGestureEnd` / `onGestureCancel` props, set only when the
scope declares `gesture`; a custom renderer with a continuous control can call
them too.

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
| `number` | number | `min`, `max`, `step`, `integer`, `suffix` (a unit, with `labelLayout`); drag the label to scrub (host `NumberField`) |
| `slider` | number | same, drawn by the host's `Slider` |
| `checkbox` | boolean | |
| `select` | string | `options`, or `optionsProvider(ctx)` for dynamic lists |
| `color` | hex string | `presets`; the host's `ColorField` |
| `vector` | number array | N scalars in one row — Houdini's `float3` / `int2`. `components` sets arity and per-slot label, suffix and range |
| `file` | `{ name }` | display only |
| `separator` | none | a horizontal rule, with `label` as an optional caption. No `path` |
| `label` | none | static text: a hint or a sub-heading. The text is `label`. No `path` |

Groups take `collapsible: true` to fold under their title, and
`defaultCollapsed: true` to start folded. The open or closed state belongs to
the group, so it resets when the panel remounts.

---

## Views: inspector, card, collapsed

One scope draws three ways. `view` on `PropertyPanel` picks one:

- **`"inspector"`**, the default: every group and field.
- **`"card"`**: the fields promoted to the card, with no group chrome. The
  schema's `title` heads it. The panel's `title` prop overrides that, for an
  instance name such as "Filter 2".
- **`"collapsed"`**: the fields promoted to collapsed, one compact row each.
  This is a scope folded shut. The host draws the title bar that folds it and
  holds the open or closed state.

A field lists the views it shows in besides the inspector, the way a Houdini
asset promotes a parm to its interface:

```ts
const FILTER: PropertySchema = {
  version: 1,
  title: "Filter",
  groups: [
    {
      id: "filter",
      title: "Filter",
      collapsible: true,
      rows: [
        { kind: "select", id: "type", path: "type", options: TYPES, promote: ["collapsed"] },
        { kind: "slider", id: "master", path: "master", promote: ["card", "collapsed"] },
        { kind: "slider", id: "resonance", path: "resonance" },
        { kind: "slider", id: "pan", path: "pan", promote: ["card"] },
      ],
    },
  ],
};
```

```tsx
<PropertyPanel scopeKey="filter" selection={node} ctx={ctx} view="card" title={node.name} />
```

The card shows master and pan. Folded, the scope shows type and master.
Resonance is inspector-only. The views are independent: `["collapsed"]` is not
on the card.

A closed collapsible group shows its `collapsed` fields under its title, so
folding a group still leaves its main value in reach.

Renderers receive the view as an optional `view` prop. The built-ins draw a
compact row in `"collapsed"`. A custom renderer may ignore it.
`promotedFields(schema, view)` returns the fields a view draws, in schema
order, for a host that wants to skip an empty card.

---

## JSON Schema

A schema for editors and agents is published at
`https://facets.preset.nz/schema/v0.1.json`, and ships in the package as
`@preset.nz/facets/schema/v0.1.json`. Point a JSON file at it:

```json
{
  "$schema": "https://facets.preset.nz/schema/v0.1.json",
  "version": 1,
  "groups": []
}
```

Built-in kinds are checked strictly: a misspelt prop or a missing `path` is an
error. Any other kind passes as a custom kind, so a misspelt *kind* is not
caught here; the panel logs a warning and skips the field. `optionsProvider` is
code, so it has no JSON form.

One file covers every 0.1.x release. Patches may add kinds and props to it,
never remove or tighten them.

### For agents

`https://facets.preset.nz/llms.txt` is the contract in brief. A Claude Code
plugin with a skill for writing schemas, scopes and custom renderers lives in
this repo:

```sh
claude plugin marketplace add preset-nz/facets
claude plugin install facets@preset-nz-facets
```

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

A renderer receives `field`, `value`, `disabled`, `onChange`, `ctx` and `view`.
Pick what it uses rather than spreading the props onto a DOM element, where
React warns about the unknown ones.

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
