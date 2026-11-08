import type { Curve, CurvePoint } from "@preset.nz/math"
import {
  adsrOf,
  CurveEditor,
  type CurveEditorProps,
  constrainAdsr,
  constrainGamma,
  gammaCurve,
  gammaLine,
  gammaOf,
  Histogram,
} from "@preset.nz/ux-kit/graphics"

import type { Gesture, Row } from "../rhizome"
import { DOC_PAGE, DocHeader } from "./Header"
import { PHOTO } from "./histograms"
import type { SetValue } from "./index"

/** The ADSR stays inside the editor's two seconds. */
const ADSR_LIMITS = constrainAdsr(2)
/** The gamma stays inside levels' range. */
const GAMMA_LIMITS = constrainGamma(0.1, 5)
const seconds = (x: number) => `${x.toFixed(3)} s`

/** A curve as rhizome hands it back: optional fields may arrive as `null`. */
function toCurve(v: unknown): Curve {
  const raw = (v ?? {}) as {
    points?: (CurvePoint & { tension?: number | null })[]
    sustain?: number | null
  }
  const points = (raw.points ?? []).map(({ tension, ...p }) =>
    tension == null ? p : { ...p, tension },
  )
  return raw.sustain == null ? { points } : { points, sustain: raw.sustain }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

/**
 * The `curves` document: `CurveEditor` on three curves held as shaped rhizome values. A drag
 * is one gesture, so one undo step; a nudge coalesces; anything else is one labelled edit.
 */
export function CurvesDoc({ row, set, gesture }: { row: Row; set: SetValue; gesture: Gesture }) {
  const bind = (
    key: string,
  ): Pick<CurveEditorProps, "value" | "onChange" | "onGestureStart" | "onGestureEnd"> => ({
    value: toCurve(row.values?.[key]),
    onGestureStart: () => gesture.begin(row.path, key),
    onChange: (next, kind) => {
      if (kind === "gesture") gesture.apply(row.path, key, next)
      else set(row.path, key, next, kind === "nudge")
    },
    onGestureEnd: (committed) => (committed ? gesture.end() : gesture.cancel()),
  })
  const adsr = adsrOf(toCurve(row.values?.adsr))
  const gamma = typeof row.values?.gamma === "number" ? row.values.gamma : 1
  const writeGamma: CurveEditorProps["onChange"] = (next, kind) => {
    const g = gammaOf(next)
    if (g === null) return
    if (kind === "gesture") gesture.apply(row.path, "gamma", g)
    else set(row.path, "gamma", g, kind === "nudge")
  }

  return (
    <div className={DOC_PAGE}>
      <DocHeader title="Curves">
        CurveEditor on synthetic curves. Drag points and the diamond tension handles, double-click
        to add a point, Delete to remove one, arrows to nudge. Basis and sustain are in the context
        menu; the diamonds bend linear segments only, so set a point to Linear to get one. Escape
        cancels a drag; Cmd+Z undoes a whole drag.
      </DocHeader>
      <div className="flex flex-col gap-8">
        <Section title="Transfer, over a histogram">
          <CurveEditor
            {...bind("transfer")}
            aria-label="Transfer curve"
            background={<Histogram bins={PHOTO} aria-label="Histogram of a synthetic photo" />}
            className="aspect-square h-auto max-w-80"
          />
        </Section>
        <Section title="Gamma, one point">
          <CurveEditor
            value={gammaCurve(gamma)}
            onChange={writeGamma}
            onGestureStart={() => gesture.begin(row.path, "gamma")}
            onGestureEnd={(committed) => (committed ? gesture.end() : gesture.cancel())}
            constrain={GAMMA_LIMITS}
            line={gammaLine}
            background={<Histogram bins={PHOTO} aria-label="Histogram of a synthetic photo" />}
            aria-label="Gamma curve"
            className="aspect-square h-auto max-w-80"
          />
          <p className="font-mono text-xs text-muted-foreground">Gamma {gamma.toFixed(2)}</p>
        </Section>
        <Section title="Envelope, free">
          <CurveEditor
            {...bind("envelope")}
            mode="envelope"
            xDomain={[0, 2]}
            formatX={seconds}
            aria-label="Free envelope"
          />
        </Section>
        <Section title="Envelope, ADSR">
          <CurveEditor
            {...bind("adsr")}
            mode="envelope"
            xDomain={[0, 2]}
            constrain={ADSR_LIMITS}
            formatX={seconds}
            aria-label="ADSR envelope"
          />
          <p className="font-mono text-xs text-muted-foreground">
            {adsr
              ? `A ${seconds(adsr.attack)} · D ${seconds(adsr.decay)} · S ${adsr.sustain.toFixed(2)} · R ${seconds(adsr.release)}`
              : "Not an ADSR shape"}
          </p>
        </Section>
      </div>
    </div>
  )
}
