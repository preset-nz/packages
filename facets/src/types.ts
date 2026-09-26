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
  promote?: PromoteLevel
}

/**
 * Where a field shows besides the inspector, like a parm promoted to a
 * Houdini asset's interface. The levels nest: `"collapsed"` fields show in a
 * closed group's header, in a folded scope and on the card; `"card"` fields
 * show on the card only. Leave it out and the field is inspector-only.
 */
export type PromoteLevel = "collapsed" | "card"

/**
 * How `PropertyPanel` draws a scope. `"inspector"` is every field in its
 * groups; `"card"` the promoted fields, flat; `"collapsed"` the fields
 * promoted to `"collapsed"`, on one line.
 */
export type PanelView = "inspector" | "card" | "collapsed"

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
  promote?: PromoteLevel
}

/** Static text: a hint, a note, a sub-heading. The text is `label`. */
export interface LabelFieldDef {
  kind: "label"
  id: string
  label: string
  disabledWhen?: DisabledWhen
  promote?: PromoteLevel
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
  groups: PropertyGroupDef[]
}

// Opaque to the package. Each host types its own context.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopeContext = any

export interface Scope<S = unknown, V = Record<string, unknown>> {
  schema: PropertySchema
  read: (selection: S, ctx: ScopeContext) => V
  write?: (
    path: string,
    value: unknown,
    selection: S,
    ctx: ScopeContext,
  ) => void
}

export interface FieldRendererProps<F extends FieldDef = FieldDef> {
  field: F
  value: unknown
  disabled: boolean
  onChange?: (next: unknown) => void
  ctx: ScopeContext
  /**
   * The view the field is drawn in. In `"collapsed"` it shares a line with
   * others, so built-ins draw compact. Optional: a renderer may ignore it.
   */
  view?: PanelView
}

export type FieldRenderer<F extends FieldDef = FieldDef> = React.FC<
  FieldRendererProps<F>
>

import type React from "react"
