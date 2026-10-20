import * as React from "react"
import { AlertShell } from "./alert-shell"
import { Button } from "./button"
import { formatBytes, Progress } from "./progress"

// DownloadPrompt: one dialog for a download, in three states the caller drives:
// ask first, show progress, offer Retry. It owns no timer and no network; the
// caller sets `state` to null when the download is done. Escape always means
// "stop": Not now, Cancel, Close.

type DownloadPromptProps = {
  /** `null` is closed. */
  state: "ask" | "downloading" | "failed" | null
  /** "Smart Select needs a model". */
  title: string
  /** What is being downloaded: "MobileSAM". */
  name: string
  /** Formatted by the caller; an omitted fact is left out of the line. */
  facts: { size?: string; licence?: string; host?: string }
  /** Bytes, while downloading. Without it the bar is indeterminate. */
  progress?: { done: number; total: number }
  /** One line, when failed. */
  reason?: string
  /** ask: Download. */
  onDownload: () => void
  /** ask: Not now. failed: Close. */
  onDismiss: () => void
  /** downloading: Cancel. */
  onCancel: () => void
  /** failed: Retry. */
  onRetry: () => void
}

function DownloadPrompt(props: DownloadPromptProps) {
  // Keep the last open props so the closing animation shows the old content, not a blank dialog.
  const last = React.useRef<DownloadPromptProps & { state: "ask" | "downloading" | "failed" }>(null)
  if (props.state !== null) last.current = { ...props, state: props.state }
  const shown = last.current
  const focusRef = React.useRef<HTMLButtonElement>(null)

  // initialFocus only acts on open. A state change swaps the buttons out from under the focus,
  // so move it to the new state's default button.
  React.useEffect(() => {
    if (props.state !== null) focusRef.current?.focus()
  }, [props.state])

  if (shown === null) return null
  const { state, title, name, facts, progress, reason } = shown
  // Callbacks come from the live props: the stored copy may be a render old.
  const live = props
  const onEscape = state === "downloading" ? live.onCancel : live.onDismiss

  const factLine = [facts.size, facts.licence, facts.host ? `from ${facts.host}` : undefined]
    .filter(Boolean)
    .join(" · ")

  return (
    <AlertShell
      open={props.state !== null}
      onDismiss={onEscape}
      title={title}
      initialFocus={focusRef}
      footer={
        state === "ask" ? (
          <>
            <Button variant="outline" onClick={live.onDismiss}>
              Not now
            </Button>
            <Button ref={focusRef} onClick={live.onDownload}>
              Download
            </Button>
          </>
        ) : state === "downloading" ? (
          <Button ref={focusRef} variant="outline" onClick={live.onCancel}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={live.onDismiss}>
              Close
            </Button>
            <Button ref={focusRef} onClick={live.onRetry}>
              Retry
            </Button>
          </>
        )
      }
    >
      <p className="font-medium text-foreground">{name}</p>
      {state === "ask" && factLine ? <p className="mt-1">{factLine}</p> : null}
      {state === "downloading" ? (
        <Progress
          className="mt-3"
          label={name}
          value={progress ? progress.done : null}
          max={progress?.total}
          detail={
            progress ? `${formatBytes(progress.done)} / ${formatBytes(progress.total)}` : undefined
          }
        />
      ) : null}
      {state === "failed" && reason ? <p className="mt-1">{reason}</p> : null}
    </AlertShell>
  )
}

export type { DownloadPromptProps }
export { DownloadPrompt }
