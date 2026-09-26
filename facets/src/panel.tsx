import { useId, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { getFieldRenderer, getScope } from "./registry"
import type {
  FieldDef,
  PanelView,
  PropertyGroupDef,
  PropertySchema,
  ScopeContext,
} from "./types"

interface PropertyPanelProps {
  scopeKey: string
  selection: unknown
  ctx: ScopeContext
  readOnly?: boolean
  emptyState?: React.ReactNode
  /** Defaults to `"inspector"`, every field. See `PanelView`. */
  view?: PanelView
  /** The card's heading. Overrides the schema's `title`; neither means no heading. */
  title?: React.ReactNode
}

type Row = Array<FieldDef | FieldDef[]>[number]

/** Whether a field shows in a view: every field in the inspector, else only those promoted to it. */
export function showsIn(field: FieldDef, view: PanelView): boolean {
  return view === "inspector" || (field.promote?.includes(view) ?? false)
}

/** The fields a view draws, in schema order, with paired rows flattened. */
export function promotedFields(schema: PropertySchema, view: PanelView): FieldDef[] {
  return schema.groups
    .flatMap((g) => g.rows)
    .flatMap((row) => (Array.isArray(row) ? row : [row]))
    .filter((f) => showsIn(f, view))
}

/** A group's rows kept to one view: fields filtered, empty rows dropped. */
function rowsIn(rows: Row[], view: PanelView): FieldDef[][] {
  return rows
    .map((row) => (Array.isArray(row) ? row : [row]).filter((f) => showsIn(f, view)))
    .filter((fields) => fields.length > 0)
}

export function PropertyPanel({
  scopeKey,
  selection,
  ctx,
  readOnly = false,
  emptyState,
  view = "inspector",
  title,
}: PropertyPanelProps) {
  const scope = getScope(scopeKey)

  const values = useMemo(() => {
    if (!scope) return {} as Record<string, unknown>
    try {
      return scope.read(selection, ctx) as Record<string, unknown>
    } catch (e) {
      console.error("[properties] scope read failed:", scopeKey, e)
      return {} as Record<string, unknown>
    }
  }, [scope, scopeKey, selection, ctx])

  if (!scope) return <>{emptyState ?? null}</>

  const onChange = readOnly || !scope.write
    ? undefined
    : (path: string, val: unknown) => scope.write!(path, val, selection, ctx)

  // Collapsed: what a folded scope still shows, one compact row per field.
  // The host draws the title bar that folds it. Nothing when nothing is
  // promoted.
  if (view === "collapsed") {
    const fields = promotedFields(scope.schema, "collapsed")
    if (fields.length === 0) return null
    return (
      <div className="px-3 py-2">
        <CompactRows fields={fields} values={values} ctx={ctx} onChange={onChange} />
      </div>
    )
  }

  // Card: an optional heading, then the fields promoted to it, with no group
  // chrome.
  if (view === "card") {
    const rows = scope.schema.groups.flatMap((g) => rowsIn(g.rows, "card"))
    const heading = title ?? scope.schema.title
    if (rows.length === 0 && !heading) return null
    return (
      <div className="flex flex-col">
        {heading && (
          <header className="border-b border-border px-3 py-2 text-xs font-semibold">
            {heading}
          </header>
        )}
        {rows.length > 0 && (
          <div className="flex flex-col gap-3 px-3 py-3">
            <Rows rows={rows} values={values} ctx={ctx} onChange={onChange} view="card" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {scope.schema.groups.map((group, idx) => (
        <PropertyGroup
          key={group.id}
          group={group}
          values={values}
          ctx={ctx}
          onChange={onChange}
          isLast={idx === scope.schema.groups.length - 1}
        />
      ))}
    </div>
  )
}

function PropertyGroup({
  group,
  values,
  ctx,
  onChange,
  isLast,
}: {
  group: PropertyGroupDef
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  isLast: boolean
}) {
  // Collapsing needs a title to click. Open or closed is the group's own
  // state; a host that wants it remembered across selections keys the panel.
  const collapsible = Boolean(group.collapsible && group.title)
  const [collapsed, setCollapsed] = useState(
    collapsible && Boolean(group.defaultCollapsed),
  )
  const bodyId = useId()
  // A closed group keeps its "collapsed" fields, as compact rows under its title.
  const headerFields = collapsible && collapsed ? rowsIn(group.rows, "collapsed").flat() : []
  const titleClass =
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <section className="flex flex-col gap-3 px-3 py-3">
      {(group.title || group.description) && (
        <header>
          {group.title &&
            (collapsible ? (
              <h3 className={titleClass}>
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls={bodyId}
                  onClick={() => setCollapsed((c) => !c)}
                  className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 px-1 text-left uppercase hover:text-foreground"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className={
                      "size-3 shrink-0 transition-transform " +
                      (collapsed ? "-rotate-90" : "")
                    }
                  >
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {group.title}
                </button>
              </h3>
            ) : (
              <h3 className={titleClass}>{group.title}</h3>
            ))}
          {group.description && !(collapsible && collapsed) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {group.description}
            </p>
          )}
        </header>
      )}
      {headerFields.length > 0 && (
        <CompactRows fields={headerFields} values={values} ctx={ctx} onChange={onChange} />
      )}
      <div id={bodyId} hidden={collapsible && collapsed} className="flex flex-col gap-3">
        <Rows
          rows={rowsIn(group.rows, "inspector")}
          values={values}
          ctx={ctx}
          onChange={onChange}
          view="inspector"
        />
      </div>
      {!isLast && <Separator className="mt-1" />}
    </section>
  )
}

/** One field per row, label and control side by side: the collapsed views. */
function CompactRows({
  fields,
  values,
  ctx,
  onChange,
}: {
  fields: FieldDef[]
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {fields.map((f) => (
        <FieldSlot key={f.id} field={f} values={values} ctx={ctx} onChange={onChange} view="collapsed" />
      ))}
    </div>
  )
}

function Rows({
  rows,
  values,
  ctx,
  onChange,
  view,
}: {
  rows: FieldDef[][]
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  view: PanelView
}) {
  return rows.map((fields, idx) => (
    <div
      key={idx}
      className={fields.length > 1 ? "grid grid-cols-2 gap-2" : undefined}
    >
      {fields.map((f) => (
        <FieldSlot
          key={f.id}
          field={f}
          values={values}
          ctx={ctx}
          onChange={onChange}
          view={view}
        />
      ))}
    </div>
  ))
}

function FieldSlot({
  field,
  values,
  ctx,
  onChange,
  view,
}: {
  field: FieldDef
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  view: PanelView
}) {
  const renderer = getFieldRenderer(field.kind)
  if (!renderer) {
    console.warn("[properties] no renderer for kind:", field.kind)
    return null
  }
  const disabled = (() => {
    const cond = field.disabledWhen
    if (!cond) return false
    const v = values[cond.path]
    if (Object.prototype.hasOwnProperty.call(cond, "equals"))
      return v === cond.equals
    if (Object.prototype.hasOwnProperty.call(cond, "notEquals"))
      return v !== cond.notEquals
    if (cond.in) return cond.in.includes(v)
    if (cond.notIn) return !cond.notIn.includes(v)
    return false
  })()

  // Display-only kinds (separator, label) have no path: no value, no writes.
  const path = "path" in field ? field.path : undefined
  return renderer({
    field,
    value: path === undefined ? undefined : values[path],
    disabled,
    onChange:
      onChange && path !== undefined ? (val) => onChange(path, val) : undefined,
    ctx,
    view,
  })
}
