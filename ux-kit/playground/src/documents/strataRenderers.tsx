/* eslint-disable react-refresh/only-export-components --
 * Renderers + the registration entry point are colocated by design. */

import type { FieldRenderer } from "@preset.nz/facets"
import { FieldShell, ReadOnlyText, registerFieldRenderer } from "@preset.nz/facets"

// Strata's custom field renderers, copied verbatim from
// `initiatives/strata/src/features/properties/renderers.tsx` (all but `colour-label`, which no
// inspector uses), with the VGA16 tables from its `src/lib/vga16.ts` inlined. One change from
// Strata: they sit in facets' `FieldShell` and `ReadOnlyText` (facets 0.2) instead of a label-above
// shell of their own, so they follow the panel's label layout. Strata takes this when it moves to
// facets 0.2 with ux-kit.

export const VGA16_BUCKETS = [
  "black",
  "maroon",
  "red",
  "purple",
  "fuchsia",
  "green",
  "lime",
  "olive",
  "yellow",
  "navy",
  "blue",
  "teal",
  "aqua",
  "silver",
  "gray",
  "white",
] as const

export type Vga16Bucket = (typeof VGA16_BUCKETS)[number]

export const VGA16_HEX: Record<Vga16Bucket, string> = {
  black: "#000000",
  maroon: "#800000",
  red: "#ff0000",
  purple: "#800080",
  fuchsia: "#ff00ff",
  green: "#008000",
  lime: "#00ff00",
  olive: "#808000",
  yellow: "#ffff00",
  navy: "#000080",
  blue: "#0000ff",
  teal: "#008080",
  aqua: "#00ffff",
  silver: "#c0c0c0",
  gray: "#808080",
  white: "#ffffff",
}

export const VGA16_LABEL: Record<Vga16Bucket, string> = {
  black: "Black",
  maroon: "Maroon",
  red: "Red",
  purple: "Purple",
  fuchsia: "Fuchsia",
  green: "Green",
  lime: "Lime",
  olive: "Olive",
  yellow: "Yellow",
  navy: "Navy",
  blue: "Blue",
  teal: "Teal",
  aqua: "Aqua",
  silver: "Silver",
  gray: "Grey",
  white: "White",
}

const Vga16BucketRenderer: FieldRenderer = ({ field, value, view }) => {
  const bucket = value as Vga16Bucket | null | undefined
  const hex = bucket ? VGA16_HEX[bucket] : null
  const label = bucket ? VGA16_LABEL[bucket] : null
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <ReadOnlyText>
        <div className="flex items-center gap-2">
          {hex ? (
            <span
              aria-hidden
              className="inline-block size-4 shrink-0 border border-border"
              style={{ backgroundColor: hex }}
            />
          ) : (
            <span className="inline-block size-4 shrink-0 border border-dashed border-border" />
          )}
          <span className="text-xs text-foreground">
            {label ?? <span className="text-muted-foreground">—</span>}
          </span>
        </div>
      </ReadOnlyText>
    </FieldShell>
  )
}

const StatusRenderer: FieldRenderer = ({ field, value, view }) => {
  const status = String(value ?? "")
  const tone = (() => {
    if (status === "ready") return "text-foreground"
    if (status === "missing" || status === "failed") return "text-destructive"
    return "text-muted-foreground"
  })()
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <ReadOnlyText>
        <span className={`capitalize ${tone}`}>
          {status || <span className="text-muted-foreground">—</span>}
        </span>
      </ReadOnlyText>
    </FieldShell>
  )
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const DateRenderer: FieldRenderer = ({ field, value, view }) => {
  const iso = value as string | null | undefined
  const formatted = iso ? DATE_FMT.format(new Date(iso)) : null
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <ReadOnlyText>{formatted ?? <span className="text-muted-foreground">—</span>}</ReadOnlyText>
    </FieldShell>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileSizeRenderer: FieldRenderer = ({ field, value, view }) => {
  const bytes = value as number | null | undefined
  return (
    <FieldShell label={field.label ?? field.id} view={view}>
      <ReadOnlyText>
        {bytes != null ? formatBytes(bytes) : <span className="text-muted-foreground">—</span>}
      </ReadOnlyText>
    </FieldShell>
  )
}

const KeywordsRenderer: FieldRenderer = ({ field, value, view }) => {
  const list = Array.isArray(value) ? (value as string[]) : []
  return (
    <FieldShell label={field.label ?? field.id} view={view} top>
      {list.length === 0 ? (
        <ReadOnlyText>
          <span className="text-muted-foreground">—</span>
        </ReadOnlyText>
      ) : (
        <div className="flex flex-wrap gap-1 py-1.5">
          {list.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </FieldShell>
  )
}

export function registerStrataRenderers(): void {
  registerFieldRenderer("vga16-bucket", Vga16BucketRenderer)
  registerFieldRenderer("status-pill", StatusRenderer)
  registerFieldRenderer("date", DateRenderer)
  registerFieldRenderer("file-size", FileSizeRenderer)
  registerFieldRenderer("keyword-chips", KeywordsRenderer)
}
