/* eslint-disable react-refresh/only-export-components --
 * Renderers + the registration entry point are colocated by design. */
import { registerFieldRenderer } from "@preset.nz/facets"
import type { FieldRenderer } from "@preset.nz/facets"
import { Label } from "@/components/ui/label"

// Strata's custom field renderers, copied verbatim from
// `initiatives/strata/src/features/properties/renderers.tsx` (all but `colour-label`, which no
// inspector uses), with the VGA16 tables from its `src/lib/vga16.ts` inlined. They draw their
// own label-above shell and ignore facets' label layout: that is as Strata ships them.

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

function FieldShell({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <Label className="text-[11px] font-medium text-muted-foreground tracking-wide">
          {label}
        </Label>
      )}
      {children}
    </div>
  )
}

const Vga16BucketRenderer: FieldRenderer = ({ field, value }) => {
  const bucket = value as Vga16Bucket | null | undefined
  const hex = bucket ? VGA16_HEX[bucket] : null
  const label = bucket ? VGA16_LABEL[bucket] : null
  return (
    <FieldShell label={field.label ?? field.id}>
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
    </FieldShell>
  )
}


const StatusRenderer: FieldRenderer = ({ field, value }) => {
  const status = String(value ?? "")
  const tone = (() => {
    if (status === "ready") return "text-foreground"
    if (status === "missing" || status === "failed") return "text-destructive"
    return "text-muted-foreground"
  })()
  return (
    <FieldShell label={field.label ?? field.id}>
      <div className={`text-xs capitalize ${tone}`}>
        {status || <span className="text-muted-foreground">—</span>}
      </div>
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

const DateRenderer: FieldRenderer = ({ field, value }) => {
  const iso = value as string | null | undefined
  const formatted = iso ? DATE_FMT.format(new Date(iso)) : null
  return (
    <FieldShell label={field.label ?? field.id}>
      <span className="text-xs text-foreground tabular-nums">
        {formatted ?? <span className="text-muted-foreground">—</span>}
      </span>
    </FieldShell>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileSizeRenderer: FieldRenderer = ({ field, value }) => {
  const bytes = value as number | null | undefined
  return (
    <FieldShell label={field.label ?? field.id}>
      <span className="text-xs text-foreground tabular-nums">
        {bytes != null ? formatBytes(bytes) : <span className="text-muted-foreground">—</span>}
      </span>
    </FieldShell>
  )
}

const KeywordsRenderer: FieldRenderer = ({ field, value }) => {
  const list = Array.isArray(value) ? (value as string[]) : []
  return (
    <FieldShell label={field.label ?? field.id}>
      {list.length === 0 ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
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
