import {
  Component,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react"
import {
  PropertyPanel,
  getFieldRenderer,
  registerScope,
} from "../../src"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CATALOGUE, DISABLED_WHEN_DOC, type Doc, type KindEntry } from "./catalogue"
import { DEFAULT_SCHEMA, DEFAULT_VALUES, pretty } from "./defaults"
import { JsonPane } from "./json-pane"
import { clear, load, save } from "./storage"
import { parseSchema, parseValues, schemaFields } from "./parse"
import { ResizeHandle, useColumnWidths } from "./resize"

// One stable scope key. Its registration is replaced whenever the schema
// changes; `read` hands the panel the values object as the selection.
const SCOPE = "playground"

interface LogEntry {
  n: number
  path: string
  value: unknown
}

export function App() {
  const initial = useMemo(load, [])
  const [schemaText, setSchemaText] = useState(
    initial.schemaText ?? pretty(DEFAULT_SCHEMA),
  )
  const [valueText, setValueText] = useState(
    initial.valueText ?? pretty(DEFAULT_VALUES),
  )
  const [readOnly, setReadOnly] = useState(initial.readOnly ?? false)
  const [showLog, setShowLog] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [hovered, setHovered] = useState<Doc | null>(null)
  const dark = usePrefersDark()
  const cols = useColumnWidths()

  // While either pane holds invalid JSON, keep showing the last good version.
  const schemaParse = useMemo(() => parseSchema(schemaText), [schemaText])
  const valueParse = useMemo(() => parseValues(valueText), [valueText])
  const lastSchema = useLastGood(schemaParse, DEFAULT_SCHEMA)
  const lastValues = useLastGood(valueParse, DEFAULT_VALUES)

  const valuesRef = useRef(lastValues)
  valuesRef.current = lastValues
  const logCount = useRef(0)

  useMemo(
    () =>
      registerScope<Record<string, unknown>, Record<string, unknown>>(SCOPE, {
        schema: lastSchema,
        read: (selection) => selection,
        write: (path, value) => {
          const next = { ...valuesRef.current, [path]: value }
          valuesRef.current = next
          setValueText(pretty(next))
          const n = ++logCount.current
          setLog((l) => [{ n, path, value }, ...l].slice(0, 200))
        },
      }),
    [lastSchema],
  )

  useEffect(() => {
    save({ schemaText, valueText, readOnly })
  }, [schemaText, valueText, readOnly])

  const unknownKinds = useMemo(
    () =>
      [...new Set(schemaFields(lastSchema).map((f) => f.kind))].filter(
        (k) => !getFieldRenderer(k),
      ),
    [lastSchema],
  )

  const addField = (entry: KindEntry) => {
    if (!schemaParse.ok) return
    const schema = structuredClone(schemaParse.value)
    const taken = new Set(schemaFields(schema).flatMap((f) => [f.id, f.path]))
    let n = 1
    let made = entry.make(n)
    while (taken.has(made.field.id) || taken.has(made.field.path)) made = entry.make(++n)
    if (schema.groups.length === 0) schema.groups.push({ id: "group", title: "Group", rows: [] })
    schema.groups[schema.groups.length - 1].rows.push(made.field)
    setSchemaText(pretty(schema))
    setValueText(pretty({ ...valuesRef.current, [made.field.path]: made.value }))
  }

  // Makes the last field depend on the nearest checkbox before it. If there
  // is none, a checkbox is inserted just above the field first.
  const addDisabledWhen = () => {
    if (!schemaParse.ok) return
    const schema = structuredClone(schemaParse.value)
    const fields = schemaFields(schema)
    const target = fields.at(-1)
    if (!target) return
    let values = valuesRef.current
    let driver = fields.slice(0, -1).reverse().find((f) => f.kind === "checkbox")
    if (!driver) {
      const entry = CATALOGUE.find((e) => e.kind === "checkbox")!
      const taken = new Set(fields.flatMap((f) => [f.id, f.path]))
      let n = 1
      let made = entry.make(n)
      while (taken.has(made.field.id) || taken.has(made.field.path)) made = entry.make(++n)
      driver = made.field
      for (const group of schema.groups) {
        const at = group.rows.findIndex((row) => (Array.isArray(row) ? row.includes(target) : row === target))
        if (at >= 0) {
          group.rows.splice(at, 0, driver)
          break
        }
      }
      values = { ...values, [driver.path]: made.value }
    }
    target.disabledWhen = { path: driver.path, equals: false }
    setSchemaText(pretty(schema))
    setValueText(pretty(values))
  }

  const reset = () => {
    clear()
    setSchemaText(pretty(DEFAULT_SCHEMA))
    setValueText(pretty(DEFAULT_VALUES))
    setReadOnly(false)
    setLog([])
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
        <h1 className="font-mono text-sm font-medium">@preset.nz/facets</h1>
        <span className="text-xs text-muted-foreground">playground</span>
        <nav className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <a className="hover:text-foreground" href="https://github.com/preset-nz/facets">
            GitHub
          </a>
          <a className="hover:text-foreground" href="https://www.npmjs.com/package/@preset.nz/facets">
            npm
          </a>
        </nav>
      </header>

      <main
        className="grid min-h-0 flex-1 grid-cols-1 overflow-auto md:grid-cols-(--cols) md:overflow-hidden"
        style={{ "--cols": `${cols.widths.palette}px ${cols.widths.json}px minmax(0,1fr)` } as CSSProperties}
      >
        {/* Palette */}
        <aside className="relative flex min-h-0 flex-col border-b border-border bg-card md:border-r md:border-b-0">
          <ResizeHandle
            label="Resize field kinds"
            width={cols.widths.palette}
            onWidth={(px) => cols.set("palette", px)}
            onReset={() => cols.reset("palette")}
          />
          <PaneTitle>Field kinds</PaneTitle>
          <ul className="min-h-0 flex-1 overflow-auto py-1">
            {CATALOGUE.map((entry) => (
              <li key={entry.kind}>
                <button
                  type="button"
                  disabled={!schemaParse.ok}
                  onClick={() => addField(entry)}
                  onMouseEnter={() => setHovered(entry)}
                  onFocus={() => setHovered(entry)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-xs hover:bg-accent disabled:opacity-50"
                >
                  {entry.kind}
                  {entry.custom && (
                    <span className="font-sans text-[10px] text-muted-foreground">custom</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <PaneTitle>Conditions</PaneTitle>
          <button
            type="button"
            disabled={!schemaParse.ok}
            onClick={addDisabledWhen}
            onMouseEnter={() => setHovered(DISABLED_WHEN_DOC)}
            onFocus={() => setHovered(DISABLED_WHEN_DOC)}
            className="flex w-full px-3 py-1.5 text-left font-mono text-xs hover:bg-accent disabled:opacity-50"
          >
            disabledWhen
          </button>
          <KindCard entry={hovered} />
        </aside>

        {/* JSON */}
        <section className="relative flex min-h-[40rem] flex-col border-b border-border md:min-h-0 md:border-r md:border-b-0">
          <ResizeHandle
            label="Resize JSON"
            width={cols.widths.json}
            onWidth={(px) => cols.set("json", px)}
            onReset={() => cols.reset("json")}
          />
          <JsonPane
            title="schema.json"
            text={schemaText}
            onText={setSchemaText}
            error={schemaParse.ok ? null : schemaParse.error}
            dark={dark}
          />
          <JsonPane
            title="value.json"
            text={valueText}
            onText={setValueText}
            error={valueParse.ok ? null : valueParse.error}
            dark={dark}
          />
        </section>
        {/* Preview */}
        <section className="flex min-h-0 flex-col">
          <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border px-3">
            <Label className="text-xs text-muted-foreground">
              <Checkbox checked={readOnly} onCheckedChange={(c) => setReadOnly(Boolean(c))} />
              Read-only
            </Label>
            <Label className="text-xs text-muted-foreground">
              <Checkbox checked={showLog} onCheckedChange={(c) => setShowLog(Boolean(c))} />
              Write log
            </Label>
            <button
              type="button"
              onClick={reset}
              title="Restore the starting schema and values"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowCounterClockwiseIcon className="size-3.5" /> Reset
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
            {unknownKinds.length > 0 && (
              <p className="mb-3 w-80 text-xs text-destructive">
                No renderer registered for{" "}
                {unknownKinds.map((k) => `"${k}"`).join(", ")}. The panel skips
                those fields.
              </p>
            )}
            <div className="w-80 border border-border bg-background shadow-sm">
              <PanelBoundary resetKey={schemaText}>
                <PropertyPanel
                  scopeKey={SCOPE}
                  selection={lastValues}
                  ctx={null}
                  readOnly={readOnly}
                />
              </PanelBoundary>
            </div>
          </div>
          {showLog && <WriteLog log={log} onClear={() => setLog([])} />}
        </section>

      </main>
    </div>
  )
}

function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex h-8 shrink-0 items-center border-b border-border px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function KindCard({ entry }: { entry: Doc | null }) {
  if (!entry) {
    return (
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        Click a kind to add it to the last group. Hover over one to see its props.
      </p>
    )
  }
  // Kinds show the exact field a click would add; conditions carry their own.
  const example =
    entry.example ?? ("make" in entry ? pretty((entry as KindEntry).make(1).field) : null)
  return (
    <div className="max-h-[50%] overflow-auto border-t border-border p-3 text-xs">
      <p className="font-mono font-medium">{entry.kind}</p>
      <p className="mt-1 text-muted-foreground">{entry.blurb}</p>
      {entry.props.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
          {entry.props.map(([name, doc]) => (
            <div key={name} className="contents">
              <dt className="font-mono">{name}</dt>
              <dd className="text-muted-foreground">{doc}</dd>
            </div>
          ))}
        </dl>
      )}
      {example && (
        <pre className="mt-2 overflow-x-auto bg-muted p-2 font-mono text-[11px] select-text">
          {example}
        </pre>
      )}
      <p className="mt-2 text-muted-foreground">
        Every field also takes <span className="font-mono">label</span> and{" "}
        <span className="font-mono">disabledWhen</span>.
      </p>
    </div>
  )
}

function WriteLog({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
  return (
    <div className="flex h-40 shrink-0 flex-col border-t border-border">
      <div className="flex h-7 shrink-0 items-center justify-between px-3 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono">write(path, value)</span>, newest first
        </span>
        <button type="button" onClick={onClear} className="hover:text-foreground">
          Clear
        </button>
      </div>
      <ol className="min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[11px]">
        {log.length === 0 && (
          <li className="text-muted-foreground">Nothing written yet. Change a field.</li>
        )}
        {log.map((e) => (
          <li key={e.n} className="flex gap-3">
            <span className="w-8 shrink-0 text-right text-muted-foreground">{e.n}</span>
            <span>
              {e.path} <span className="text-muted-foreground">←</span> {JSON.stringify(e.value)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function useLastGood<T>(parsed: Parsed<T>, fallback: T): T {
  const last = useRef(fallback)
  if (parsed.ok) last.current = parsed.value
  return last.current
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  )
}

/** A schema that parses but breaks a renderer shouldn't take the page down. */
class PanelBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { error: string | null; key: string }
> {
  state = { error: null as string | null, key: this.props.resetKey }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { error: string | null; key: string },
  ) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }
  render() {
    if (this.state.error) {
      return (
        <p className={cn("p-3 font-mono text-[11px] text-destructive")}>
          The panel threw: {this.state.error}
        </p>
      )
    }
    return this.props.children
  }
}
