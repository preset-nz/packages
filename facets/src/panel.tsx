import { createContext, useContext, useId, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LABEL_WIDTH_VAR, LabelLayoutContext, labelColumnWidth, useLabelLayout } from "./layout"
import { getFieldRenderer, getScope } from "./registry"
import type {
  FieldDef,
  LabelLayout,
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
  /**
   * Where labels sit in the inspector and card views: `"column"` (default since 0.2.0: one shared label column), `"auto"` (the 0.1 layout)
   * (one shared label column) or `"stacked"` (label above). See `LabelLayout`. The collapsed view
   * ignores it.
   */
  labelLayout?: LabelLayout
  /** `"column"` only: the label column's width as a CSS length. Default: fits the longest label, 8ch to 16ch. */
  labelWidth?: string
  /**
   * The open page's id, for a host that remembers it. Omit it and the panel
   * keeps its own, starting on the first page. An id the schema doesn't
   * declare shows the first page.
   */
  page?: string
  /** A tab was chosen. Called whether or not `page` is set. */
  onPageChange?: (page: string) => void
  /**
   * The pages whose Advanced row is open, for a host that remembers them.
   * Omit it and the panel keeps its own, every row closed. A schema without
   * `pages` has one page, whose id is `""`.
   */
  advancedOpen?: readonly string[]
  /** An Advanced row was opened or closed: the full list of open pages. */
  onAdvancedOpenChange?: (pages: string[]) => void
}

/** The scope's gesture, bound to its selection and ctx, for the field slots below. */
interface GestureHandlers {
  begin: (path: string) => void
  end: (path: string) => void
  cancel: (path: string) => void
}
const GestureContext = createContext<GestureHandlers | null>(null)

type Row = Array<FieldDef | FieldDef[]>[number]

/** One page of the inspector: its groups, and those behind its Advanced row. */
interface Page {
  id: string
  label: string
  groups: PropertyGroupDef[]
  advanced: PropertyGroupDef[]
}

/** The schema's pages, in order. No `pages` is one page, id `""`, holding every group. */
function pagesOf(schema: PropertySchema): Page[] {
  const declared = schema.pages?.length ? schema.pages : [{ id: "", label: "" }]
  return declared.map(({ id, label }) => {
    const on = schema.pages?.length ? schema.groups.filter((g) => g.page === id) : schema.groups
    return {
      id,
      label,
      groups: on.filter((g) => !g.advanced),
      advanced: on.filter((g) => g.advanced),
    }
  })
}

/** Whether any field in these groups has a path in `changed`. */
function hasChanged(groups: PropertyGroupDef[], changed: ReadonlySet<string>): boolean {
  if (changed.size === 0) return false
  return groups.some((g) =>
    g.rows.some((row) =>
      (Array.isArray(row) ? row : [row]).some((f) => "path" in f && changed.has(f.path)),
    ),
  )
}

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

export function PropertyPanel(props: PropertyPanelProps) {
  const { scopeKey, selection, ctx, readOnly = false } = props
  const gesture = getScope(scopeKey)?.gesture
  const handlers = useMemo<GestureHandlers | null>(
    () =>
      readOnly || !gesture
        ? null
        : {
            begin: (path) => gesture.begin(path, selection, ctx),
            end: (path) => gesture.end(path, selection, ctx),
            cancel: (path) => gesture.cancel?.(path, selection, ctx),
          },
    [readOnly, gesture, selection, ctx],
  )
  return (
    <GestureContext.Provider value={handlers}>
      <PanelBody {...props} />
    </GestureContext.Provider>
  )
}

function PanelBody({
  scopeKey,
  selection,
  ctx,
  readOnly = false,
  emptyState,
  view = "inspector",
  title,
  labelLayout = "column",
  labelWidth,
  ...pageProps
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

  const changed = useMemo(() => {
    try {
      return new Set(scope?.changed?.(selection, ctx) ?? [])
    } catch (e) {
      console.error("[properties] scope changed failed:", scopeKey, e)
      return new Set<string>()
    }
  }, [scope, scopeKey, selection, ctx])

  if (!scope) return <>{emptyState ?? null}</>

  const onChange =
    readOnly || !scope.write
      ? undefined
      : (path: string, val: unknown) => scope.write?.(path, val, selection, ctx)

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
      <LabelLayoutContext.Provider value={labelLayout}>
        <div className="flex flex-col" style={columnStyle(labelLayout, labelWidth, rows.flat())}>
          {heading && (
            <header className="border-b border-border px-3 py-2 text-xs font-semibold">
              {heading}
            </header>
          )}
          {rows.length > 0 && (
            <div className={`flex flex-col px-3 py-3 ${rowGap(labelLayout)}`}>
              <Rows rows={rows} values={values} ctx={ctx} onChange={onChange} view="card" />
            </div>
          )}
        </div>
      </LabelLayoutContext.Provider>
    )
  }

  // One label column across every page, so it doesn't jump between tabs.
  const all = scope.schema.groups.flatMap((g) => rowsIn(g.rows, "inspector")).flat()
  return (
    <LabelLayoutContext.Provider value={labelLayout}>
      <div className="flex flex-col" style={columnStyle(labelLayout, labelWidth, all)}>
        <Inspector
          schema={scope.schema}
          values={values}
          ctx={ctx}
          onChange={onChange}
          changed={changed}
          {...pageProps}
        />
      </div>
    </LabelLayoutContext.Provider>
  )
}

type PageProps = Pick<
  PropertyPanelProps,
  "page" | "onPageChange" | "advancedOpen" | "onAdvancedOpenChange"
>

/**
 * The inspector view: the tab row when there are two pages or more, then the
 * open page. The open page, each page's Advanced row and each group's fold are
 * held here, above the tabs, so they survive switching pages.
 */
function Inspector({
  schema,
  values,
  ctx,
  onChange,
  changed,
  page,
  onPageChange,
  advancedOpen,
  onAdvancedOpenChange,
}: PageProps & {
  schema: PropertySchema
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  changed: ReadonlySet<string>
}) {
  const pages = pagesOf(schema)
  const [ownPage, setOwnPage] = useState<string>()
  const [ownAdvanced, setOwnAdvanced] = useState<readonly string[]>([])
  // Groups folded the other way from their `defaultCollapsed`, so a group
  // added later still starts as its schema says.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set())

  const wanted = page ?? ownPage
  const current = pages.find((p) => p.id === wanted) ?? pages[0]
  const open = advancedOpen ?? ownAdvanced
  const choosePage = (id: string) => {
    setOwnPage(id)
    onPageChange?.(id)
  }
  const toggleAdvanced = (id: string) => {
    const next = open.includes(id) ? open.filter((p) => p !== id) : [...open, id]
    setOwnAdvanced(next)
    onAdvancedOpenChange?.(next)
  }
  const flip = (id: string) =>
    setFlipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const body = (p: Page) => (
    <PageBody
      page={p}
      values={values}
      ctx={ctx}
      onChange={onChange}
      changed={changed}
      flipped={flipped}
      onFlip={flip}
      advancedOpen={open.includes(p.id)}
      onAdvancedToggle={() => toggleAdvanced(p.id)}
    />
  )
  if (pages.length < 2) return body(current)

  // The open tab shows its own fields, so only the others carry the mark.
  // TabsContent's own text size would differ from an unpaged panel's.
  return (
    <Tabs value={current.id} onValueChange={(v) => choosePage(String(v))}>
      <div className="px-3 pt-3">
        <TabsList className="w-full">
          {pages.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.label}
              {p.id !== current.id && hasChanged([...p.groups, ...p.advanced], changed) && (
                <ChangedMark />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {pages.map((p) => (
        <TabsContent key={p.id} value={p.id} className="text-[length:inherit]">
          {body(p)}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** A page's groups, then its advanced groups behind one closed Advanced row. */
function PageBody({
  page,
  values,
  ctx,
  onChange,
  changed,
  flipped,
  onFlip,
  advancedOpen,
  onAdvancedToggle,
}: {
  page: Page
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  changed: ReadonlySet<string>
  flipped: ReadonlySet<string>
  onFlip: (id: string) => void
  advancedOpen: boolean
  onAdvancedToggle: () => void
}) {
  const advancedId = useId()
  const group = (g: PropertyGroupDef, isLast: boolean) => (
    <PropertyGroup
      key={g.id}
      group={g}
      values={values}
      ctx={ctx}
      onChange={onChange}
      changed={changed}
      flipped={flipped.has(g.id)}
      onFlip={() => onFlip(g.id)}
      isLast={isLast}
    />
  )
  const { groups, advanced } = page
  return (
    <>
      {groups.map((g, idx) => group(g, idx === groups.length - 1 && advanced.length === 0))}
      {advanced.length > 0 && (
        <>
          <section className="flex flex-col gap-3 px-3 py-3">
            <header>
              <FoldHeader
                title="Advanced"
                open={advancedOpen}
                onToggle={onAdvancedToggle}
                controls={advancedId}
                changed={!advancedOpen && hasChanged(advanced, changed)}
              />
            </header>
          </section>
          <div id={advancedId} hidden={!advancedOpen} className="flex flex-col">
            {advanced.map((g, idx) => group(g, idx === advanced.length - 1))}
          </div>
        </>
      )}
    </>
  )
}

/** The shared label width, as a style on the panel root; nothing outside `"column"`. */
function columnStyle(layout: LabelLayout, width: string | undefined, fields: FieldDef[]) {
  return layout === "column"
    ? ({ [LABEL_WIDTH_VAR]: width ?? labelColumnWidth(fields) } as React.CSSProperties)
    : undefined
}

/** Space between rows: tighter in a label column, where the rows read as a table. */
const rowGap = (layout: LabelLayout) => (layout === "column" ? "gap-1.5" : "gap-3")

const TITLE_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/**
 * A fold's title: chevron and title, a button that opens and closes `controls`.
 * Collapsible groups and the Advanced row both draw it. `changed` marks a
 * closed fold that hides a changed field.
 */
function FoldHeader({
  title,
  open,
  onToggle,
  controls,
  changed,
}: {
  title: React.ReactNode
  open: boolean
  onToggle: () => void
  controls: string
  changed: boolean
}) {
  return (
    <h3 className={TITLE_CLASS}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 px-1 text-left uppercase hover:text-foreground"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {title}
        {changed && <ChangedMark />}
      </button>
    </h3>
  )
}

/** The mark on a tab or fold that hides a changed field: a dot, read as "changed". The row's gap spaces it. */
function ChangedMark() {
  return (
    <>
      <span aria-hidden>•</span>
      <span className="sr-only">, changed</span>
    </>
  )
}

function PropertyGroup({
  group,
  values,
  ctx,
  onChange,
  changed,
  flipped,
  onFlip,
  isLast,
}: {
  group: PropertyGroupDef
  values: Record<string, unknown>
  ctx: ScopeContext
  onChange?: (path: string, val: unknown) => void
  changed: ReadonlySet<string>
  /** Folded the other way from `defaultCollapsed`. */
  flipped: boolean
  onFlip: () => void
  isLast: boolean
}) {
  // Collapsing needs a title to click. Open or closed is the panel's state;
  // a host that wants it remembered across selections keys the panel.
  const collapsible = Boolean(group.collapsible && group.title)
  const collapsed = collapsible && Boolean(group.defaultCollapsed) !== flipped
  const bodyId = useId()
  const layout = useLabelLayout()
  // A closed group keeps its "collapsed" fields, as compact rows under its title.
  const headerFields = collapsible && collapsed ? rowsIn(group.rows, "collapsed").flat() : []

  return (
    <section className="flex flex-col gap-3 px-3 py-3">
      {(group.title || group.description) && (
        <header>
          {group.title &&
            (collapsible ? (
              <FoldHeader
                title={group.title}
                open={!collapsed}
                onToggle={onFlip}
                controls={bodyId}
                changed={collapsed && hasChanged([group], changed)}
              />
            ) : (
              <h3 className={TITLE_CLASS}>{group.title}</h3>
            ))}
          {group.description && !(collapsible && collapsed) && (
            <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
          )}
        </header>
      )}
      {headerFields.length > 0 && (
        <CompactRows fields={headerFields} values={values} ctx={ctx} onChange={onChange} />
      )}
      <div
        id={bodyId}
        hidden={collapsible && collapsed}
        className={`flex flex-col ${rowGap(layout)}`}
      >
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
        <FieldSlot
          key={f.id}
          field={f}
          values={values}
          ctx={ctx}
          onChange={onChange}
          view="collapsed"
        />
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
  // In a label column a pair has no room for two labels: its fields take a row each.
  const layout = useLabelLayout()
  return rows.map((fields, idx) => (
    <div
      // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id; the list is rebuilt from the schema
      key={idx}
      className={
        fields.length > 1
          ? layout === "column"
            ? "contents"
            : "grid grid-cols-2 gap-2"
          : undefined
      }
    >
      {fields.map((f) => (
        <FieldSlot key={f.id} field={f} values={values} ctx={ctx} onChange={onChange} view={view} />
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
  const gesture = useContext(GestureContext)
  const renderer = getFieldRenderer(field.kind)
  if (!renderer) {
    console.warn("[properties] no renderer for kind:", field.kind)
    return null
  }
  const disabled = (() => {
    const cond = field.disabledWhen
    if (!cond) return false
    const v = values[cond.path]
    if (Object.hasOwn(cond, "equals")) return v === cond.equals
    if (Object.hasOwn(cond, "notEquals")) return v !== cond.notEquals
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
    onChange: onChange && path !== undefined ? (val) => onChange(path, val) : undefined,
    onGestureBegin: gesture && path !== undefined ? () => gesture.begin(path) : undefined,
    onGestureEnd: gesture && path !== undefined ? () => gesture.end(path) : undefined,
    onGestureCancel: gesture && path !== undefined ? () => gesture.cancel(path) : undefined,
    ctx,
    view,
  })
}
