import { useState, type Ref } from "react"
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { BracketsCurlyIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react"

const extensions = [json()]

export function JsonPane({
  title,
  text,
  onText,
  error,
  dark,
  onCursor,
  editorRef,
  status,
  warnings = [],
}: {
  title: string
  text: string
  onText: (text: string) => void
  error: string | null
  dark: boolean
  /** Called with the caret's offset whenever it moves. */
  onCursor?: (offset: number) => void
  editorRef?: Ref<ReactCodeMirrorRef>
  /** A quiet line under the editor, e.g. where the next insert lands. */
  status?: string | null
  /** Schema-validation messages: shown, but they don't block the panel. */
  warnings?: string[]
}) {
  const [copied, setCopied] = useState(false)
  const prettify = () => {
    try {
      onText(JSON.stringify(JSON.parse(text), null, 2))
    } catch {
      // Invalid JSON: the button is disabled, and the error is already shown.
    }
  }
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-border last:border-b-0">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="font-mono text-[11px] text-muted-foreground">{title}</h2>
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={prettify}
          disabled={error !== null}
          title={`Prettify ${title}`}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <BracketsCurlyIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={copy}
          title={`Copy ${title}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto text-xs">
        <CodeMirror
          value={text}
          ref={editorRef}
          onChange={onText}
          onUpdate={(u) => {
            if (onCursor && (u.selectionSet || u.docChanged)) onCursor(u.state.selection.main.head)
          }}
          extensions={extensions}
          theme={dark ? "dark" : "light"}
          basicSetup={{ autocompletion: false }}
          className="h-full [&_.cm-editor]:h-full [&_.cm-editor]:bg-transparent! [&_.cm-gutters]:bg-transparent!"
        />
      </div>
      {warnings.length > 0 && !error && (
        <ul className="shrink-0 border-t border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {status && !error && (
        <p className="shrink-0 border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
          {status}
        </p>
      )}
      {error && (
        <p className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
