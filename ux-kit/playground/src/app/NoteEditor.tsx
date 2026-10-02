import { useEffect, useState } from "react"
import { EmptyState, Icons, Input, Textarea } from "@preset.nz/ux-kit"

import type { Row } from "../rhizome"

/**
 * The selected note: title (rename) and body (set body). Each commit is one labelled
 * rhizome edit, on blur or Enter, so typing does not flood the history.
 */
export function NoteEditor({
  note,
  empty,
  onRename,
  onSetBody,
}: {
  note: Row | null
  /** True when the document has no notes at all. */
  empty: boolean
  onRename: (path: string, name: string) => void
  onSetBody: (path: string, body: string) => void
}) {
  const body = typeof note?.values?.body === "string" ? note.values.body : ""
  const [title, setTitle] = useState(note?.name ?? "")
  const [text, setText] = useState(body)

  // Follow the tree: selection changes, undo and redo all land here as new props.
  useEffect(() => setTitle(note?.name ?? ""), [note?.id, note?.name])
  useEffect(() => setText(body), [note?.id, body])

  if (!note) {
    return (
      <EmptyState
        icon={<Icons.NoteIcon />}
        title={empty ? "No notes yet" : "No note selected"}
        description={empty ? "Add a note from the toolbar (⌘N)." : "Pick a note in the outline."}
      />
    )
  }

  const commitTitle = () => {
    const name = title.trim()
    if (name === "" || name === note.name) setTitle(note.name)
    else onRename(note.path, name)
  }
  const commitBody = () => {
    if (text !== body) onSetBody(note.path, text)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 p-6">
      <Input
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setTitle(note.name)
        }}
        className="h-auto border-transparent px-0 font-heading text-2xl font-semibold shadow-none"
      />
      <Textarea
        aria-label="Body"
        value={text}
        placeholder="Write something."
        onChange={(e) => setText(e.target.value)}
        onBlur={commitBody}
        className="min-h-0 flex-1 resize-none"
      />
    </div>
  )
}
