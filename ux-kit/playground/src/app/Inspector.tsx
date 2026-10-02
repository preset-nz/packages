import { useEffect, useRef, useState } from "react"
import { Button, ColorSwatch, Input, Label, SidePanelContent, SidePanelHeader } from "@preset.nz/ux-kit"

import { docInfo, type SetValue } from "../documents"
import { CardPanel } from "../documents/CardPanel"
import { BoolField, NumbersField, nums, TextField } from "../documents/fields"
import { ROLES, SIZES, WEIGHTS } from "../documents/fonts"
import { TOKENS } from "../documents/tokens"
import type { Gesture, History, Row, Schema, ValueSchema } from "../rhizome"
import { selectLayer, setFontSample, useFontSamples, type Selection } from "../selection"

const show = (v: unknown) => (typeof v === "string" ? v || "—" : JSON.stringify(v))

function Prop({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate font-mono" title={typeof children === "string" ? children : undefined}>
        {children}
      </dd>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

const Props = ({ children }: { children: React.ReactNode }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">{children}</dl>
)

/** The open document with nothing selected inside it: what it is, and what it holds. */
function DocSummary({ doc, layers }: { doc: Row | null; layers: Row[] }) {
  if (!doc) return <p className="text-xs text-muted-foreground">No document open.</p>
  const values = Object.entries(doc.values ?? {})
  return (
    <>
      <Section title="Document">
        <Props>
          <Prop k="name">{docInfo(doc.type)?.label ?? doc.name}</Prop>
          <Prop k="path">{doc.path}</Prop>
          <Prop k="type">{doc.type}</Prop>
          <Prop k="id">{doc.id}</Prop>
        </Props>
      </Section>
      {values.length > 0 && (
        <Section title="Values">
          <Props>
            {values.map(([k, v]) => (
              <Prop key={k} k={k}>
                {show(v)}
              </Prop>
            ))}
          </Props>
        </Section>
      )}
      {doc.type === "card" && (
        <Section title="Layers">
          <ul className="flex flex-col gap-0.5 text-xs">
            {layers.map((l) => (
              <li key={l.id}>
                <button type="button" className="hover:underline" onClick={() => selectLayer(l.id)}>
                  {String(l.values?.name ?? l.name)}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="text-xs text-muted-foreground">Select an item in the document to inspect it. Esc clears.</p>
    </>
  )
}

/** A token: its swatches in both modes, the variable and where it is used. Read-only. */
function TokenInspector({ name }: { name: string }) {
  const t = TOKENS.find((x) => x.name === name)
  if (!t) return null
  return (
    <>
      <Section title="Token">
        <div className="font-mono text-sm font-medium">{t.name}</div>
        <Props>
          <Prop k="group">{t.group}</Prop>
        </Props>
      </Section>
      <Section title="Values">
        <div className="flex flex-col gap-2 text-xs">
          {(["light", "dark"] as const).map((mode) => (
            <div key={mode} className="flex items-center gap-2">
              <ColorSwatch size="lg" color={t[mode]} aria-label={`${mode} value`} />
              <span className="w-8 text-muted-foreground">{mode}</span>
              <span className="min-w-0 truncate font-mono" title={t[mode]}>
                {t[mode]}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Use">
        <Props>
          <Prop k="css">{`var(${t.name})`}</Prop>
          {t.utility && (
            <>
              <Prop k="tailwind">{`bg-${t.utility}`}</Prop>
              <Prop k="">{`text-${t.utility}`}</Prop>
              <Prop k="">{`border-${t.utility}`}</Prop>
            </>
          )}
        </Props>
      </Section>
    </>
  )
}

/** A font role: the stack the browser resolves, weights, sizes, and a sample to type into. */
function FontInspector({ role }: { role: string }) {
  const r = ROLES.find((x) => x.role === role)
  const probe = useRef<HTMLSpanElement>(null)
  const [stack, setStack] = useState("")
  const sample = useFontSamples()[role] ?? ""
  useEffect(() => {
    if (probe.current) setStack(getComputedStyle(probe.current).fontFamily)
  }, [role])
  if (!r) return null
  return (
    <>
      <span ref={probe} className={r.cls} hidden />
      <Section title="Font">
        <div className="text-sm font-medium">{r.role}</div>
        <Props>
          <Prop k="variable">{r.token}</Prop>
          <Prop k="tailwind">{r.cls}</Prop>
        </Props>
        <p className="break-words font-mono text-xs">{stack}</p>
      </Section>
      <Section title="Sample text">
        <Label htmlFor="font-sample" className="sr-only">
          Sample text
        </Label>
        <Input
          id="font-sample"
          value={sample}
          placeholder={r.sample}
          onChange={(e) => setFontSample(role, e.target.value)}
        />
        <p className={`${r.cls} break-words text-lg`}>{sample || r.sample}</p>
      </Section>
      <Section title="Weights">
        <Props>
          {WEIGHTS.map((w) => (
            <Prop key={w.w} k={String(w.w)}>
              {`${w.name} (${w.cls})`}
            </Prop>
          ))}
        </Props>
      </Section>
      <Section title="Sizes">
        <Props>
          {SIZES.map((s) => (
            <Prop key={s.cls} k={`${s.px}px`}>
              {s.cls}
            </Prop>
          ))}
        </Props>
      </Section>
    </>
  )
}

/** The editor for one value, by its kind. Same rhizome edit as the row in the centre. */
function ValueEditor({ doc, spec, set, gesture }: { doc: Row; spec: ValueSchema; set: SetValue; gesture: Gesture }) {
  const current = doc.values?.[spec.key]
  const put = (value: unknown) => set(doc.path, spec.key, value)
  switch (spec.kind) {
    case "bool":
      return <BoolField label={spec.key} value={current === true} onCommit={put} />
    case "text":
      return (
        <TextField label={spec.key} value={String(current ?? "")} multiline={spec.key === "notes"} onCommit={put} />
      )
    case "vec2":
    case "vec3":
    case "floats": {
      const labels = spec.kind === "vec2" ? ["X", "Y"] : spec.kind === "vec3" ? ["X", "Y", "Z"] : null
      const n = Array.isArray(spec.default) ? spec.default.length : 0
      const list = nums(current, n)
      return (
        <NumbersField
          path={doc.path}
          valueKey={spec.key}
          values={list}
          set={set}
          gesture={gesture}
          labels={labels ?? list.map((_, i) => String(i + 1))}
          orientation="column"
          step={spec.key === "weights" ? 0.01 : 0.1}
        />
      )
    }
    default:
      return <p className="text-xs text-muted-foreground">No editor for {spec.kind} values.</p>
  }
}

/** One value of the Primitives node: key, kind, default, current, an editor, and reset. */
function ValueInspector({
  doc,
  valueKey,
  schema,
  set,
  gesture,
  reset,
}: {
  doc: Row
  valueKey: string
  schema: Schema | null
  set: SetValue
  gesture: Gesture
  reset: (path: string, keys: string[]) => void
}) {
  const spec = schema?.types.find((t) => t.name === doc.type)?.values?.find((v) => v.key === valueKey)
  if (!spec) return <p className="text-xs text-muted-foreground">Loading…</p>
  const isSet = doc.set?.includes(valueKey) ?? false
  return (
    <>
      <Section title="Value">
        <Props>
          <Prop k="key">{spec.key}</Prop>
          <Prop k="kind">{spec.kind}</Prop>
          <Prop k="default">{show(spec.default)}</Prop>
          <Prop k="current">{show(doc.values?.[valueKey])}</Prop>
          {spec.range && <Prop k="range">{`${spec.range[0]} to ${spec.range[1]}`}</Prop>}
        </Props>
      </Section>
      <Section title="Edit">
        <ValueEditor doc={doc} spec={spec} set={set} gesture={gesture} />
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={!isSet}
          title={isSet ? undefined : "Already at its default"}
          onClick={() => reset(doc.path, [valueKey])}
        >
          Reset this value
        </Button>
      </Section>
    </>
  )
}

/**
 * Follows the selection inside the open document: a token, a font role, a primitive value or a
 * layer. With none selected it shows the document's summary. The tree's history sits below.
 */
export function Inspector({
  doc,
  layers,
  selection,
  schema,
  history,
  set,
  gesture,
  reset,
}: {
  doc: Row | null
  layers: Row[]
  selection: Selection
  schema: Schema | null
  history: History | null
  set: SetValue
  gesture: Gesture
  reset: (path: string, keys: string[]) => void
}) {
  const layer = selection.kind === "layer" ? layers.find((l) => l.id === selection.id) : undefined
  return (
    <>
      <SidePanelHeader>Inspector</SidePanelHeader>
      <SidePanelContent className="flex flex-col gap-6 p-3">
        {selection.kind === "token" ? (
          <TokenInspector name={selection.name} />
        ) : selection.kind === "font" ? (
          <FontInspector role={selection.role} />
        ) : selection.kind === "value" && doc ? (
          <ValueInspector doc={doc} valueKey={selection.key} schema={schema} set={set} gesture={gesture} reset={reset} />
        ) : layer ? (
          <Section title={String(layer.values?.name ?? layer.name)}>
            {/* facets brings its own px-3 gutter; cancel the inspector's so they don't stack */}
            <div className="-mx-3">
              <CardPanel key={layer.id} row={layer} set={set} view="inspector" />
            </div>
          </Section>
        ) : (
          <DocSummary doc={doc} layers={layers} />
        )}

        <Section title="History">
          {history && (
            <ol className="flex flex-col gap-0.5 font-mono text-xs">
              {history.undo_labels.map((label, i) => (
                <li key={`u${i}`}>
                  <span className="text-muted-foreground">{i + 1}</span> {label}
                </li>
              ))}
              <li className="text-primary">— now —</li>
              {history.redo_labels.map((label, i) => (
                <li key={`r${i}`} className="text-muted-foreground">
                  {history.history_len + i + 1} {label}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </SidePanelContent>
    </>
  )
}
