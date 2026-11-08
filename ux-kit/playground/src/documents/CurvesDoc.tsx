import type { Curve, CurvePoint } from "@preset.nz/math"
import {
  adsrOf,
  CurveEditor,
  type CurveEditorProps,
  constrainAdsr,
  constrainLevels,
  Histogram,
  levelsCurve,
  levelsLine,
  levelsOf,
} from "@preset.nz/ux-kit/graphics"

import { useRef } from "react"

import type { Gesture, Row } from "../rhizome"
import { DOC_PAGE, DocHeader } from "./Header"
import { PHOTO } from "./histograms"
import type { SetValue } from "./index"

/** The ADSR stays inside the editor's two seconds. */
const ADSR_LIMITS = constrainAdsr(2)
/** Gamma stays inside levels' range. */
const LEVELS_LIMITS = constrainLevels(0.1, 5)
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
  const num = (key: string, fallback: number) => {
    const v = row.values?.[key]
    return typeof v === "number" ? v : fallback
  }
  const levels = {
    black: num("black", 0),
    white: num("white", 1),
    gamma: num("gamma", 1),
    outBlack: num("outBlack", 0),
    outWhite: num("outWhite", 1),
  }
  // A drag moves one thing, an end (two keys) or the gamma point, and the gesture opens on that key
  // once the first move shows which.
  const dragging = useRef<"idle" | "pending" | "open">("idle")
  const writeLevels: CurveEditorProps["onChange"] = (next, kind) => {
    const l = levelsOf(next)
    if (!l) return
    for (const key of ["black", "white", "gamma", "outBlack", "outWhite"] as const) {
      if (Math.abs(l[key] - levels[key]) <= 1e-9) continue
      if (kind === "gesture") {
        if (dragging.current === "pending") {
          gesture.begin(row.path, key)
          dragging.current = "open"
        }
        gesture.apply(row.path, key, l[key])
      } else set(row.path, key, l[key], kind === "nudge")
    }
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
        <Section title="Levels: black, white and gamma">
          <CurveEditor
            value={levelsCurve(levels)}
            onChange={writeLevels}
            onGestureStart={() => {
              dragging.current = "pending"
            }}
            onGestureEnd={(committed) => {
              if (dragging.current === "open") committed ? gesture.end() : gesture.cancel()
              dragging.current = "idle"
            }}
            constrain={LEVELS_LIMITS}
            line={levelsLine}
            background={<Histogram bins={PHOTO} aria-label="Histogram of a synthetic photo" />}
            aria-label="Levels curve"
            className="aspect-square h-auto max-w-80"
          />
          <p className="font-mono text-xs text-muted-foreground">
            Black {levels.black.toFixed(3)} · White {levels.white.toFixed(3)} · Gamma{" "}
            {levels.gamma.toFixed(2)} · Output {levels.outBlack.toFixed(3)} to{" "}
            {levels.outWhite.toFixed(3)}
          </p>
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
