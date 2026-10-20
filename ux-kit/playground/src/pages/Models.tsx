import {
  ModelDeclined,
  ModelPromptHost,
  ModelsProvider,
  ModelsSection,
  useModelGate,
} from "@preset.nz/app-kit/models"
import { Button, Label } from "@preset.nz/ux-kit"
import { useEffect, useMemo, useState } from "react"

import { createFakeModelsApi } from "./fakeModels"

// app-kit's models, on a fake backend: the Settings section, and the prompt a tool opens with
// `ensure`. The real page of Settings is app-kit story 05; this is the pieces themselves.

function Tools() {
  const gate = useModelGate()
  const [log, setLog] = useState<string[]>([])

  const run = (id: string, tool: string) => {
    const say = (line: string) => setLog((l) => [line, ...l].slice(0, 6))
    gate.ensure(id, { for: tool }).then(
      () => say(`${tool}: ready, armed`),
      (e) => say(e instanceof ModelDeclined ? `${tool}: declined, not armed` : `${tool}: ${e}`),
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold">A tool awaits a model</h2>
      <p className="text-sm text-muted-foreground">
        Each button calls <code>ensure</code>. Try Download, Not now, Cancel; the Upscaler fails
        once, then Retry works. Whisper tiny is ready, so it resolves at once.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => run("mobile_sam", "Smart Select")}>
          Smart Select (MobileSAM)
        </Button>
        <Button variant="outline" onClick={() => run("upscaler", "Upscale")}>
          Upscale (fails once)
        </Button>
        <Button variant="outline" onClick={() => run("whisper_tiny", "Transcribe")}>
          Transcribe (ready)
        </Button>
      </div>
      <Label className="text-muted-foreground">Results</Label>
      <ul className="min-h-24 text-sm">
        {log.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log of short lines
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

export function ModelsPage() {
  const [run, setRun] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` is the reset: a fresh fake each time
  const api = useMemo(() => createFakeModelsApi(), [run])
  useEffect(() => () => api.stop(), [api])

  return (
    <ModelsProvider api={api} key={run}>
      <div className="max-w-2xl space-y-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-heading text-2xl font-semibold">Models</h1>
          <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
            Reset
          </Button>
        </div>
        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Settings section</h2>
          <div className="rounded-md border border-border">
            <ModelsSection />
          </div>
        </section>
        <Tools />
        <ModelPromptHost />
      </div>
    </ModelsProvider>
  )
}
