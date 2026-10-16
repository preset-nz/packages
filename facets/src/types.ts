// Built-in kinds shipped with the package. Apps may register additional kinds
// via `registerFieldRenderer(kind, Component)` — the panel looks up by string.
export type BuiltinFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "slider"
  | "select"
  | "color"
  | "checkbox"
  | "file"
  | "vector"
  | "separator"
  | "label"

export interface BaseField {
  kind: string
  id: string
  label?: string
  path: string
  disabledWhen?: DisabledWhen
  promote?: PromoteView[]
}

/**
 * A view a field can be promoted to, like a parm promoted to a Houdini
 * asset's interface. `promote` lists them, each chosen on its own:
 * `"card"` shows the field on the card; `"collapsed"` in a closed group's
 * header and in a folded scope. Leave `promote` out and the field is
 * inspector-only.
 */
export type PromoteView = "card" | "collapsed"

/**
 * How `PropertyPanel` draws a scope. `"inspector"` is every field in its
 * groups; `"card"` the fields promoted to it, flat; `"collapsed"` the
 * fields promoted to it, on one line.
 */
export type PanelView = "inspector" | "card" | "collapsed"

/**
 * Where a field's label sits, for the inspector and card views. `"auto"` (the default) is the
 * original layout: number and vector fields carry their label inside the box as the scrub
 * handle, other fields stack it above. `"column"` puts every label in one shared column to the
 * left, so the controls start on one edge. `"stacked"` puts every label above its control.
 * Paired rows (`[a, b]`) draw one field per row in `"column"`.
 */
export type LabelLayout = "auto" | "column" | "stacked"

/**
 * Disables a field based on one other field's value. Exactly one operator is
 * meant to be set; if several are, the first present in the order
 * `equals`, `notEquals`, `in`, `notIn` wins. `in`/`notIn` match a list of
 * values (e.g. "only these enum choices use this param") and are still a
 * single-path condition — composable AND/OR belongs in a later DSL.
 */
export interface DisabledWhen {
  path: string
  equals?: unknown
  notEquals?: unknown
  in?: readonly unknown[]
  notIn?: readonly unknown[]
}

// A custom field is any BaseField whose `kind` is not one of the built-ins.
// The host's registered renderer for that kind decides what extra props it reads.
export type CustomFieldDef = BaseField & {
  [extra: string]: unknown
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldDef extends BaseField {
  kind: "select"
  options?: SelectOption[]
  optionsProvider?: (ctx: ScopeContext) => SelectOption[]
}

export interface ColorFieldDef extends BaseField {
  kind: "color"
  presets?: string[]
}

export interface TextFieldDef extends BaseField {
  kind: "text"
  placeholder?: string
}

export interface TextareaFieldDef extends BaseField {
  kind: "textarea"
  placeholder?: string
  rows?: number
}

export interface NumberFieldDef extends BaseField {
  kind: "number"
  min?: number
  max?: number
  step?: number
  /** Whole numbers only: no fractional display, and a fine-step modifier never goes finer than `step`. */
  integer?: boolean
  /** A unit after the number, e.g. `px` or `°`. Shown when the panel's `labelLayout` is `"column"` or `"stacked"`. */
  suffix?: string
}

export interface SliderFieldDef extends BaseField {
  kind: "slider"
  min?: number
  max?: number
  step?: number
}

export interface CheckboxFieldDef extends BaseField {
  kind: "checkbox"
}

// A tuple of related scalars sharing one row. Houdini-style float3 / int2 /
// stringN — variable arity, components share semantic context (LCh, RGB,
// position, dimensions, …). The path resolves to an array; each component
// describes one slot.
export interface VectorComponentDef {
  label?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
}

export interface VectorFieldDef extends BaseField {
  kind: "vector"
  components: VectorComponentDef[]
  integer?: boolean
  precision?: number
}

export interface FileFieldDef extends BaseField {
  kind: "file"
  accept?: string
  helperText?: string
}

// Display-only rows: they show something but hold no value, so they have no
// `path`. Houdini's Separator and Label parameter types.

/**
 * A horizontal rule between rows, with an optional caption. Every kind keeps
 * `label` so hosts can read `field.label` on any FieldDef without narrowing.
 */
export interface SeparatorFieldDef {
  kind: "separator"
  id: string
  label?: string
  disabledWhen?: DisabledWhen
  promote?: PromoteView[]
}

/** Static text: a hint, a note, a sub-heading. The text is `label`. */
export interface LabelFieldDef {
  kind: "label"
  id: string
  label: string
  disabledWhen?: DisabledWhen
  promote?: PromoteView[]
}

export type BuiltinFieldDef =
  | SelectFieldDef
  | ColorFieldDef
  | TextFieldDef
  | TextareaFieldDef
  | NumberFieldDef
  | SliderFieldDef
  | CheckboxFieldDef
  | FileFieldDef
  | VectorFieldDef
  | SeparatorFieldDef
  | LabelFieldDef

export type FieldDef = BuiltinFieldDef | CustomFieldDef

export interface PropertyGroupDef {
  id: string
  /** Omit to render the group without a header (e.g. when the host already labels it). */
  title?: string
  rows: Array<FieldDef | FieldDef[]>
  description?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export interface PropertySchema {
  version: number
  /** What the scope is called, e.g. "Filter". Heads the card; `PropertyPanel`'s `title` overrides it. */
  title?: string
  groups: PropertyGroupDef[]
}

// Opaque to the package. Each host types its own context.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopeContext = any

export interface Scope<S = unknown, V = Record<string, unknown>> {
  schema: PropertySchema
  read: (selection: S, ctx: ScopeContext) => V
  write?: (path: string, value: unknown, selection: S, ctx: ScopeContext) => void
  /**
   * One drag as one undo step. A drag is a scrubbed number, a dragged slider
   * thumb or an open colour picker; `begin` fires when it starts, every
   * `write` until `end` is part of it, and `end` closes it. `cancel` fires
   * instead of `end` when the user abandons it (Escape during a scrub): put
   * the value back. Omit `gesture` and drags are plain repeated `write`s.
   */
  gesture?: ScopeGesture<S>
}

export interface ScopeGesture<S = unknown> {
  begin: (path: string, selection: S, ctx: ScopeContext) => void
  end: (path: string, selection: S, ctx: ScopeContext) => void
  cancel?: (path: string, selection: S, ctx: ScopeContext) => void
}

export interface FieldRendererProps<F extends FieldDef = FieldDef> {
  field: F
  value: unknown
  disabled: boolean
  onChange?: (next: unknown) => void
  /**
   * A drag began, ended, or was abandoned: see `Scope.gesture`. Set only when
   * the scope declares `gesture` and the panel is editable. The built-in
   * number, vector, slider and colour renderers call them around their drags;
   * a custom renderer with a continuous control may too.
   */
  onGestureBegin?: () => void
  onGestureEnd?: () => void
  onGestureCancel?: () => void
  ctx: ScopeContext
  /**
   * The view the field is drawn in. In `"collapsed"` it shares a line with
   * others, so built-ins draw compact. Optional: a renderer may ignore it.
   */
  view?: PanelView
}

export type FieldRenderer<F extends FieldDef = FieldDef> = React.FC<FieldRendererProps<F>>

import type React from "react"
