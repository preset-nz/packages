import { createStore, useStore } from "@preset.nz/app-kit"
import {
  type PropertySchema,
  registerBuiltinRenderers,
  registerScope,
  type Scope,
  type ScopeContext,
} from "@preset.nz/facets"

import { registerStrataRenderers, type Vga16Bucket } from "./strataRenderers"

/**
 * Strata's two read-only inspectors, the image and the batch, as Strata ships them: schemas,
 * `read()` and formatters copied verbatim from `initiatives/strata/src/features/properties/scopes.ts`,
 * and `ImageDetails` / `BatchSummary` from its `contact-sheet/api.ts` and `library/api.ts`. A fork:
 * tuning here doesn't reach Strata until it is carried back. The scope keys are prefixed
 * (`strata:image`) because the registry is global. Below the copy: the samples, made up.
 */

// --- from initiatives/strata/src/features/contact-sheet/api.ts ---

export type ImageDetails = {
  id: string
  content_hash: string
  original_filename: string
  original_path: string
  byte_size: number
  mime: string
  imported_at: string
  ingest_batch_id: string
  thumbnails_status: string
  exif_created_at: string | null
  fs_mtime: string | null
  dominant_bucket: Vga16Bucket | null
  dominant_l: number | null
  dominant_c: number | null
  dominant_h: number | null

  camera_make: string | null
  camera_model: string | null
  lens_make: string | null
  lens_model: string | null
  focal_length_mm: number | null
  focal_length_35mm: number | null

  iso: number | null
  f_number: number | null
  exposure_time_sec: number | null
  exposure_bias: number | null
  exposure_program: string | null
  metering_mode: string | null
  flash_fired: boolean | null

  pixel_width: number | null
  pixel_height: number | null
  orientation: number | null
  color_space: string | null

  gps_latitude: number | null
  gps_longitude: number | null
  gps_altitude_m: number | null

  iptc_title: string | null
  iptc_caption: string | null
  iptc_byline: string | null
  iptc_copyright: string | null
  iptc_city: string | null
  iptc_state: string | null
  iptc_country: string | null
  iptc_date_created: string | null

  software: string | null
  keywords: string[]
}

// --- from initiatives/strata/src/features/library/api.ts ---

export type BatchSummary = {
  id: string
  source_folder: string
  started_at: string
  finished_at: string | null
  imported_count: number
  skipped_count: number
  failed_count: number
  image_count: number
}

// --- from initiatives/strata/src/features/properties/scopes.ts ---

type ImageSelection = { kind: "image"; id: string }
type BatchSelection = { kind: "batch"; id: string }

const IMAGE_SCHEMA: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "file",
      title: "File",
      rows: [
        { kind: "text", id: "filename", label: "Filename", path: "filename" },
        { kind: "text", id: "originalPath", label: "Source path", path: "originalPath" },
        [
          { kind: "file-size", id: "byteSize", label: "Size", path: "byteSize" },
          { kind: "text", id: "mime", label: "Type", path: "mime" },
        ],
        { kind: "date", id: "importedAt", label: "Imported", path: "importedAt" },
        {
          kind: "status-pill",
          id: "status",
          label: "Thumbnail",
          path: "status",
        },
      ],
    },
    {
      id: "dates",
      title: "Dates",
      rows: [
        {
          kind: "date",
          id: "exifCreatedAt",
          label: "Date taken (EXIF)",
          path: "exifCreatedAt",
        },
        {
          kind: "date",
          id: "iptcDateCreated",
          label: "Date created (IPTC)",
          path: "iptcDateCreated",
        },
      ],
    },
    {
      id: "camera",
      title: "Camera",
      rows: [
        { kind: "text", id: "cameraMake", label: "Make", path: "cameraMake" },
        { kind: "text", id: "cameraModel", label: "Model", path: "cameraModel" },
        { kind: "text", id: "lens", label: "Lens", path: "lens" },
      ],
    },
    {
      id: "exposure",
      title: "Exposure",
      rows: [
        [
          { kind: "text", id: "iso", label: "ISO", path: "iso" },
          { kind: "text", id: "aperture", label: "Aperture", path: "aperture" },
        ],
        [
          { kind: "text", id: "shutter", label: "Shutter", path: "shutter" },
          { kind: "text", id: "focalLength", label: "Focal", path: "focalLength" },
        ],
        [
          { kind: "text", id: "exposureBias", label: "Bias", path: "exposureBias" },
          { kind: "text", id: "exposureProgram", label: "Program", path: "exposureProgram" },
        ],
        [
          { kind: "text", id: "meteringMode", label: "Metering", path: "meteringMode" },
          { kind: "text", id: "flash", label: "Flash", path: "flash" },
        ],
      ],
    },
    {
      id: "image",
      title: "Image",
      rows: [
        {
          kind: "vector",
          id: "dimensions",
          label: "Dimensions (px)",
          path: "dimensions",
          integer: true,
          components: [{ label: "W" }, { label: "H" }],
        },
        [
          { kind: "text", id: "orientation", label: "Orientation", path: "orientation" },
          { kind: "text", id: "colorSpace", label: "Colour space", path: "colorSpace" },
        ],
      ],
    },
    {
      id: "location",
      title: "Location",
      rows: [
        {
          kind: "vector",
          id: "gpsLatLon",
          label: "Lat / Lon",
          path: "gpsLatLon",
          precision: 5,
          components: [
            { label: "Lat", suffix: "°" },
            { label: "Lon", suffix: "°" },
          ],
        },
        { kind: "text", id: "gpsAltitude", label: "Altitude", path: "gpsAltitude" },
        [
          { kind: "text", id: "city", label: "City", path: "city" },
          { kind: "text", id: "state", label: "State", path: "state" },
        ],
        { kind: "text", id: "country", label: "Country", path: "country" },
      ],
    },
    {
      id: "rights",
      title: "Rights",
      rows: [
        { kind: "text", id: "byline", label: "Creator", path: "byline" },
        { kind: "text", id: "copyright", label: "Copyright", path: "copyright" },
        { kind: "text", id: "title", label: "Title", path: "title" },
      ],
    },
    {
      id: "description",
      title: "Description",
      rows: [
        { kind: "textarea", id: "caption", label: "Caption", path: "caption", rows: 3 },
        { kind: "keyword-chips", id: "keywords", label: "Keywords", path: "keywords" },
      ],
    },
    {
      id: "colour",
      title: "Colour",
      description: "Dominant region of the image, in CIELCh.",
      rows: [
        {
          kind: "vga16-bucket",
          id: "dominantBucket",
          label: "Dominant bucket",
          path: "dominantBucket",
        },
        {
          kind: "vector",
          id: "dominantLCh",
          label: "CIELCh",
          path: "dominantLCh",
          precision: 2,
          components: [{ label: "L*" }, { label: "C*" }, { label: "h°", suffix: "°" }],
        },
      ],
    },
  ],
}

type ImageValues = {
  filename: string | null
  originalPath: string | null
  byteSize: number | null
  mime: string | null
  importedAt: string | null
  status: string | null
  exifCreatedAt: string | null
  iptcDateCreated: string | null
  cameraMake: string | null
  cameraModel: string | null
  lens: string | null
  iso: string | null
  aperture: string | null
  shutter: string | null
  focalLength: string | null
  exposureBias: string | null
  exposureProgram: string | null
  meteringMode: string | null
  flash: string | null
  dimensions: [number | null, number | null]
  orientation: string | null
  colorSpace: string | null
  gpsLatLon: [number | null, number | null]
  gpsAltitude: string | null
  city: string | null
  state: string | null
  country: string | null
  byline: string | null
  copyright: string | null
  title: string | null
  caption: string | null
  keywords: string[]
  dominantBucket: string | null
  dominantLCh: [number | null, number | null, number | null]
}

function formatShutter(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null
  if (sec >= 1) return `${sec.toFixed(sec >= 10 ? 0 : 1)} s`
  const denom = Math.round(1 / sec)
  return `1/${denom} s`
}

function formatAperture(f: number | null | undefined): string | null {
  if (f == null || !Number.isFinite(f)) return null
  return `f/${f.toFixed(f < 10 ? 1 : 0)}`
}

function formatFocalLength(
  mm: number | null | undefined,
  mm35: number | null | undefined,
): string | null {
  if (mm == null && mm35 == null) return null
  const main = mm != null ? `${mm.toFixed(0)} mm` : null
  const equiv = mm35 != null && mm35 !== mm ? ` (${mm35.toFixed(0)} mm eq.)` : ""
  return main ? main + equiv : mm35 != null ? `${mm35.toFixed(0)} mm eq.` : null
}

function formatBias(ev: number | null | undefined): string | null {
  if (ev == null || !Number.isFinite(ev)) return null
  const sign = ev > 0 ? "+" : ""
  return `${sign}${ev.toFixed(2)} EV`
}

function formatLens(make: string | null, model: string | null): string | null {
  if (model && make && !model.toLowerCase().includes(make.toLowerCase())) {
    return `${make} ${model}`
  }
  return model ?? make ?? null
}

function formatAltitude(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null
  return `${m.toFixed(0)} m`
}

const imageScope: Scope<ImageSelection, ImageValues> = {
  schema: IMAGE_SCHEMA,
  read: (_selection, ctx: ScopeContext) => {
    const d = ctx.details as ImageDetails | undefined
    return {
      filename: d?.original_filename ?? null,
      originalPath: d?.original_path ?? null,
      byteSize: d?.byte_size ?? null,
      mime: d?.mime ?? null,
      importedAt: d?.imported_at ?? null,
      status: d?.thumbnails_status ?? null,
      exifCreatedAt: d?.exif_created_at ?? null,
      iptcDateCreated: d?.iptc_date_created ?? null,
      cameraMake: d?.camera_make ?? null,
      cameraModel: d?.camera_model ?? null,
      lens: formatLens(d?.lens_make ?? null, d?.lens_model ?? null),
      iso: d?.iso != null ? String(d.iso) : null,
      aperture: formatAperture(d?.f_number),
      shutter: formatShutter(d?.exposure_time_sec),
      focalLength: formatFocalLength(d?.focal_length_mm, d?.focal_length_35mm),
      exposureBias: formatBias(d?.exposure_bias),
      exposureProgram: d?.exposure_program ?? null,
      meteringMode: d?.metering_mode ?? null,
      flash: d?.flash_fired == null ? null : d.flash_fired ? "Fired" : "No flash",
      dimensions: [d?.pixel_width ?? null, d?.pixel_height ?? null],
      orientation: d?.orientation != null ? String(d.orientation) : null,
      colorSpace: d?.color_space ?? null,
      gpsLatLon: [d?.gps_latitude ?? null, d?.gps_longitude ?? null],
      gpsAltitude: formatAltitude(d?.gps_altitude_m),
      city: d?.iptc_city ?? null,
      state: d?.iptc_state ?? null,
      country: d?.iptc_country ?? null,
      byline: d?.iptc_byline ?? null,
      copyright: d?.iptc_copyright ?? null,
      title: d?.iptc_title ?? null,
      caption: d?.iptc_caption ?? null,
      keywords: d?.keywords ?? [],
      dominantBucket: d?.dominant_bucket ?? null,
      dominantLCh: d ? [d.dominant_l, d.dominant_c, d.dominant_h] : [null, null, null],
    }
  },
}

const BATCH_SCHEMA: PropertySchema = {
  version: 1,
  groups: [
    {
      id: "identity",
      title: "Batch",
      rows: [
        { kind: "text", id: "id", label: "ID", path: "id" },
        {
          kind: "text",
          id: "sourceFolder",
          label: "Source folder",
          path: "sourceFolder",
        },
      ],
    },
    {
      id: "timing",
      title: "Timing",
      rows: [
        {
          kind: "text",
          id: "startedAt",
          label: "Started",
          path: "startedAt",
        },
        {
          kind: "text",
          id: "finishedAt",
          label: "Finished",
          path: "finishedAt",
        },
      ],
    },
    {
      id: "counts",
      title: "Counts",
      rows: [
        [
          {
            kind: "number",
            id: "imageCount",
            label: "Images",
            path: "imageCount",
          },
          {
            kind: "number",
            id: "importedCount",
            label: "Imported",
            path: "importedCount",
          },
        ],
        [
          {
            kind: "number",
            id: "skippedCount",
            label: "Skipped",
            path: "skippedCount",
          },
          {
            kind: "number",
            id: "failedCount",
            label: "Failed",
            path: "failedCount",
          },
        ],
      ],
    },
  ],
}

type BatchValues = {
  id: string | null
  sourceFolder: string | null
  startedAt: string | null
  finishedAt: string | null
  imageCount: number | null
  importedCount: number | null
  skippedCount: number | null
  failedCount: number | null
}

const batchScope: Scope<BatchSelection, BatchValues> = {
  schema: BATCH_SCHEMA,
  read: (_selection, ctx: ScopeContext) => {
    const b = ctx.batch as BatchSummary | undefined
    return {
      id: b?.id ?? null,
      sourceFolder: b?.source_folder ?? null,
      startedAt: b?.started_at ?? null,
      finishedAt: b?.finished_at ?? null,
      imageCount: b?.image_count ?? null,
      importedCount: b?.imported_count ?? null,
      skippedCount: b?.skipped_count ?? null,
      failedCount: b?.failed_count ?? null,
    }
  },
}

// --- the playground's part ---

export const STRATA_SCOPES = [
  { key: "strata:image", kind: "image", label: "Image" },
  { key: "strata:batch", kind: "batch", label: "Batch" },
] as const
export type StrataPanel = (typeof STRATA_SCOPES)[number]["kind"]
export const strataScope = (kind: string) => STRATA_SCOPES.find((s) => s.kind === kind)

let registered = false
/** Once, before the first panel. facets is `sideEffects: false`, so nothing registers on import. */
export function registerStrataScopes() {
  if (registered) return
  registered = true
  registerBuiltinRenderers()
  registerStrataRenderers()
  registerScope("strata:image", imageScope as unknown as Scope)
  registerScope("strata:batch", batchScope as unknown as Scope)
}

const NO_EXIF = {
  exif_created_at: null,
  camera_make: null,
  camera_model: null,
  lens_make: null,
  lens_model: null,
  focal_length_mm: null,
  focal_length_35mm: null,
  iso: null,
  f_number: null,
  exposure_time_sec: null,
  exposure_bias: null,
  exposure_program: null,
  metering_mode: null,
  flash_fired: null,
  pixel_width: null,
  pixel_height: null,
  orientation: null,
  color_space: null,
  gps_latitude: null,
  gps_longitude: null,
  gps_altitude_m: null,
  iptc_title: null,
  iptc_caption: null,
  iptc_byline: null,
  iptc_copyright: null,
  iptc_city: null,
  iptc_state: null,
  iptc_country: null,
  iptc_date_created: null,
  software: null,
  keywords: [],
} satisfies Partial<ImageDetails>

/** A mirrorless camera shot with everything filled in: EXIF, IPTC, GPS. */
const FULL: ImageDetails = {
  ...NO_EXIF,
  id: "img_01J9Q2",
  content_hash: "b3:9f2c41e07a",
  original_filename: "DSC04112.ARW",
  original_path: "/Volumes/Card/DCIM/100MSDCF/DSC04112.ARW",
  byte_size: 25_874_112,
  mime: "image/x-sony-arw",
  imported_at: "2026-09-28T09:14:03Z",
  ingest_batch_id: "batch_0927",
  thumbnails_status: "ready",
  exif_created_at: "2026-09-27T17:42:18Z",
  fs_mtime: "2026-09-27T17:42:18Z",
  dominant_bucket: "teal",
  dominant_l: 48.31,
  dominant_c: 22.07,
  dominant_h: 201.4,
  camera_make: "Sony",
  camera_model: "ILCE-7M4",
  lens_make: "Sony",
  lens_model: "FE 24-70mm F2.8 GM II",
  focal_length_mm: 35,
  focal_length_35mm: 35,
  iso: 400,
  f_number: 4,
  exposure_time_sec: 1 / 250,
  exposure_bias: -0.33,
  exposure_program: "Aperture priority",
  metering_mode: "Multi-segment",
  flash_fired: false,
  pixel_width: 7008,
  pixel_height: 4672,
  orientation: 1,
  color_space: "sRGB",
  gps_latitude: -41.28646,
  gps_longitude: 174.77624,
  gps_altitude_m: 12,
  iptc_title: "Harbour, late light",
  iptc_caption: "Looking across the harbour from the waterfront at dusk.",
  iptc_byline: "A. Photographer",
  iptc_copyright: "© 2026 A. Photographer",
  iptc_city: "Wellington",
  iptc_state: "Wellington",
  iptc_country: "New Zealand",
  iptc_date_created: "2026-09-27T17:42:18Z",
  software: "ILCE-7M4 v2.01",
  keywords: ["harbour", "dusk", "waterfront"],
}

/** A phone shot: camera and exposure, no lens, no IPTC, no keywords. */
const SPARSE: ImageDetails = {
  ...NO_EXIF,
  id: "img_01J9Q7",
  content_hash: "b3:41d0aa93c2",
  original_filename: "IMG_2231.HEIC",
  original_path: "/Users/me/Pictures/Phone/IMG_2231.HEIC",
  byte_size: 2_310_442,
  mime: "image/heic",
  imported_at: "2026-09-28T09:14:05Z",
  ingest_batch_id: "batch_0927",
  thumbnails_status: "pending",
  exif_created_at: "2026-09-20T08:03:51Z",
  fs_mtime: "2026-09-20T08:03:51Z",
  dominant_bucket: "olive",
  dominant_l: 61.2,
  dominant_c: 30.5,
  dominant_h: 96.8,
  camera_make: "Apple",
  camera_model: "iPhone 15",
  focal_length_mm: 6,
  focal_length_35mm: 26,
  iso: 64,
  f_number: 1.6,
  exposure_time_sec: 1 / 1600,
  exposure_bias: 0,
  flash_fired: false,
  pixel_width: 4032,
  pixel_height: 3024,
  orientation: 6,
  color_space: "Display P3",
}

/** Everything that can run long: path, filename, caption, keywords. A failed thumbnail. */
const LONG: ImageDetails = {
  ...FULL,
  id: "img_01J9QZ",
  original_filename: "2026-09-27_harbour-waterfront-late-light_final-export_v3-edited-copy.tif",
  original_path:
    "/Volumes/Archive 2026/Clients/Harbour Board/Commission – Waterfront series/Selects/Round 3/2026-09-27_harbour-waterfront-late-light_final-export_v3-edited-copy.tif",
  byte_size: 214_552_330,
  mime: "image/tiff",
  thumbnails_status: "failed",
  lens_model: "FE 70-200mm F2.8 GM OSS II with 1.4x Teleconverter",
  exposure_time_sec: 2.5,
  exposure_program: "Manual",
  metering_mode: "Centre-weighted average",
  flash_fired: true,
  iptc_title: "Waterfront at dusk, looking north-east across the harbour towards the ranges",
  iptc_caption:
    "Long exposure from the end of the wharf as the last light leaves the ranges. The ferry wake is the streak at lower left; the haze is sea spray, not smoke.\nSecond paragraph, to see a line break in a read-only caption.",
  iptc_copyright:
    "© 2026 A. Photographer. All rights reserved. Licensed to the Harbour Board for the 2026–2027 season only.",
  keywords: [
    "harbour",
    "dusk",
    "waterfront",
    "long exposure",
    "ferry",
    "wake",
    "ranges",
    "sea spray",
    "blue hour",
    "commission",
    "selects",
    "round 3",
    "landscape",
    "seascape",
    "Wellington",
    "New Zealand",
    "travel",
  ],
}

const BATCH_FULL: BatchSummary = {
  id: "batch_0927",
  source_folder: "/Volumes/Card/DCIM/100MSDCF",
  started_at: "2026-09-28T09:13:58Z",
  finished_at: "2026-09-28T09:16:41Z",
  image_count: 412,
  imported_count: 398,
  skipped_count: 12,
  failed_count: 2,
}

const BATCH_RUNNING: BatchSummary = {
  id: "batch_0928",
  source_folder: "/Users/me/Pictures/Phone",
  started_at: "2026-09-28T10:02:11Z",
  finished_at: null,
  image_count: 1_204,
  imported_count: 311,
  skipped_count: 0,
  failed_count: 0,
}

const BATCH_LONG: BatchSummary = {
  ...BATCH_FULL,
  id: "batch_01J9QZ7K3M8N2P4R6T8V0X2Z4B",
  source_folder:
    "/Volumes/Archive 2026/Clients/Harbour Board/Commission – Waterfront series/Selects/Round 3",
  image_count: 128_404,
  imported_count: 127_993,
  skipped_count: 389,
  failed_count: 22,
}

export type StrataSample = "full" | "sparse" | "long" | "empty"
export const STRATA_SAMPLES: { value: StrataSample; label: string; hint: string }[] = [
  { value: "full", label: "Full", hint: "A camera file with EXIF, IPTC and GPS" },
  {
    value: "sparse",
    label: "Sparse",
    hint: "A phone shot: no lens, no IPTC; a batch still running",
  },
  { value: "long", label: "Long", hint: "Long paths, captions and keyword lists" },
  { value: "empty", label: "Loading", hint: "No details yet: ctx is {} while the query runs" },
]

/** The `ctx` Strata's PropertiesPane passes for a panel and a sample. */
export function strataCtx(panel: StrataPanel, sample: StrataSample): ScopeContext {
  if (sample === "empty") return {}
  if (panel === "image") return { details: { full: FULL, sparse: SPARSE, long: LONG }[sample] }
  return { batch: { full: BATCH_FULL, sparse: BATCH_RUNNING, long: BATCH_LONG }[sample] }
}

// The page's view settings: not document values, not undo steps. Shared with the inspector.
export type StrataLayout = "auto" | "column" | "stacked"
export interface StrataView {
  layout: StrataLayout
  sample: StrataSample
  /** The centre panels' width in px. Strata's right pane: 320 by default, 240 to 520. */
  width: number
}
export const STRATA_LAYOUTS: { value: StrataLayout; label: string; hint: string }[] = [
  { value: "auto", label: "As shipped", hint: "Facets 0.1's layout, which Strata renders today" },
  { value: "column", label: "Label column", hint: "Facets 0.2's default: one shared label column" },
  { value: "stacked", label: "Label on top", hint: "Every label above its field" },
]
export const STRATA_WIDTHS = [240, 320, 420, 520] as const

const KEY = "ux-kit-playground.strata.view.v1"
const DEFAULT_VIEW: StrataView = { layout: "auto", sample: "full", width: 320 }
const initial = (): StrataView => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<StrataView> | null
    return { ...DEFAULT_VIEW, ...v }
  } catch {
    return DEFAULT_VIEW
  }
}
const view = createStore<StrataView>(initial())
export const useStrataView = () => useStore(view)
export const setStrataView = (patch: Partial<StrataView>) => {
  const next = { ...view.get(), ...patch }
  view.set(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // not remembered
  }
}
