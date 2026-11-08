import { Histogram, type HistogramProps } from "@preset.nz/ux-kit/graphics"

import { DOC_PAGE, DocHeader } from "./Header"
import { CLIPPED, PHOTO, POSTER } from "./histograms"

function Panel({ title, ...props }: HistogramProps & { title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="h-32 rounded-md border bg-card p-2.5">
        <Histogram aria-label={title} {...props} />
      </div>
    </section>
  )
}

/** The `histograms` document: `Histogram` on synthetic bins, each variant once. */
export function HistogramsDoc() {
  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Histograms">
        Histogram on synthetic bins: luma alone, RGB over luma, a clipped picture on a linear and a
        log scale, and a posterised one as bars. The Curves document shows it behind a transfer
        curve.
      </DocHeader>
      <div className="grid gap-6 sm:grid-cols-2">
        <Panel title="Luma" bins={{ luma: PHOTO.luma }} />
        <Panel title="RGB over luma" bins={PHOTO} />
        <Panel title="Clipped, linear" bins={CLIPPED} />
        <Panel title="Clipped, log" bins={CLIPPED} scale="log" />
        <Panel title="Posterised, bars" bins={POSTER} variant="bars" />
      </div>
    </div>
  )
}
