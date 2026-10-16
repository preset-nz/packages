import { PropertyPanel } from "@preset.nz/facets"
import { Card, ToggleGroup, ToggleGroupItem } from "@preset.nz/ux-kit"

import { selectStrataPanel, useSelection } from "../selection"
import { DOC_PAGE, DocHeader } from "./Header"
import { Selectable } from "./Selectable"
import {
  registerStrataScopes,
  STRATA_LAYOUTS,
  STRATA_SAMPLES,
  STRATA_SCOPES,
  STRATA_WIDTHS,
  type StrataPanel,
  type StrataView,
  setStrataView,
  strataCtx,
  useStrataView,
} from "./strata"

registerStrataScopes()

/** One of Strata's inspectors as its PropertiesPane draws it: read-only, the view's sample and layout. */
export function StrataPanelView({ panel, view }: { panel: StrataPanel; view: StrataView }) {
  const scope = STRATA_SCOPES.find((s) => s.kind === panel)
  if (!scope) return null
  return (
    <PropertyPanel
      scopeKey={scope.key}
      selection={{ kind: panel, id: "sample" }}
      ctx={strataCtx(panel, view.sample)}
      labelLayout={view.layout}
      readOnly
    />
  )
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        value={[String(value)]}
        onValueChange={(v) => {
          const next = options.find((o) => String(o.value) === v[0])
          if (next) onChange(next.value)
        }}
        variant="outline"
        spacing={0}
        aria-label={label}
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={String(o.value)}
            value={String(o.value)}
            title={o.hint}
            className="px-3 text-xs"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/**
 * The `inspectors` document: Strata's two read-only facets inspectors, image and batch, at
 * Strata's pane width, with sample data. The controls are view settings, not edits. Selecting a
 * panel shows it again in the inspector, at the inspector's own width.
 */
export function InspectorsDoc() {
  const selection = useSelection()
  const view = useStrataView()
  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Inspectors">
        Strata's read-only inspectors with made-up files, to tune how facets shows values it can't
        edit. "As shipped" is facets 0.1's layout, which Strata renders today. Strata's own
        renderers (dates, size, status, keywords, colour bucket) sit in facets' field shell here, so
        they follow the layout; in Strata they still put their label on top until it moves to facets
        0.2. A copy: changes here don't reach Strata.
      </DocHeader>
      <div className="mb-4 flex flex-col gap-2">
        <Choice
          label="Label layout"
          value={view.layout}
          options={STRATA_LAYOUTS}
          onChange={(layout) => setStrataView({ layout })}
        />
        <Choice
          label="Sample"
          value={view.sample}
          options={STRATA_SAMPLES}
          onChange={(sample) => setStrataView({ sample })}
        />
        <Choice
          label="Width"
          value={view.width}
          options={STRATA_WIDTHS.map((w) => ({
            value: w,
            label: `${w}`,
            hint: w === 320 ? "Strata's default" : undefined,
          }))}
          onChange={(width) => setStrataView({ width })}
        />
      </div>
      <div className="flex flex-wrap items-start gap-4 p-1">
        {STRATA_SCOPES.map((s) => (
          <Selectable
            key={s.kind}
            selected={selection.kind === "strata" && selection.panel === s.kind}
            onSelect={() => selectStrataPanel(s.kind)}
          >
            <Card className="gap-0 overflow-hidden py-0" style={{ width: view.width }}>
              <header className="flex h-9 shrink-0 items-center border-b border-border px-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </h2>
              </header>
              <StrataPanelView panel={s.kind} view={view} />
            </Card>
          </Selectable>
        ))}
      </div>
    </div>
  )
}
