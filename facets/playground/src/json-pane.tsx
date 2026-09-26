import { useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"

const extensions = [json()]

export function JsonPane({
  title,
  text,
  onText,
  error,
  dark,
}: {
  title: string
  text: string
  onText: (text: string) => void
  error: string | null
  dark: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-border last:border-b-0">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="font-mono text-[11px] text-muted-foreground">{title}</h2>
        <button
          type="button"
          onClick={copy}
          title={`Copy ${title}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto text-xs">
        <CodeMirror
          value={text}
          onChange={onText}
          extensions={extensions}
          theme={dark ? "dark" : "light"}
          basicSetup={{ autocompletion: false }}
          className="h-full [&_.cm-editor]:h-full [&_.cm-editor]:bg-transparent! [&_.cm-gutters]:bg-transparent!"
        />
      </div>
      {error && (
        <p className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
