import {
  pathFieldMenu,
  pathsExist,
  pickFile,
  recentPaths,
  rememberPath,
  revealPath,
} from "@preset.nz/app-kit"
import {
  type FileHandlers,
  PropertyPanel,
  registerBuiltinRenderers,
  registerFileHandlers,
  registerScope,
  type WriteResult,
} from "@preset.nz/facets"
import { useMemo, useState } from "react"

/** The recent list's key, shared with the "Real dialog (app-kit)" field above so the paths carry over. */
export const TEXTURE_KEY = "playground-texture"

const SCOPE = "playground-file-field"
const IMAGE = /\.(png|jpe?g|webp)$/i

interface Host {
  write: (value: unknown) => WriteResult
}

registerBuiltinRenderers()
registerScope<{ texture: string | null }, Record<string, unknown>>(SCOPE, {
  schema: {
    version: 1,
    groups: [
      {
        id: "material",
        rows: [
          {
            kind: "file",
            id: "texture",
            path: "texture",
            label: "Texture Path",
            help: "A file field on facets: the host's command refuses anything but PNG, JPEG or WebP.",
            recentKey: TEXTURE_KEY,
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
          },
        ],
      },
    ],
  },
  read: (sel) => ({ texture: sel.texture }),
  write: (_path, value, _sel, ctx: Host) => ctx.write(value),
})

/** The host registers app-kit's functions once; every `file` field in every panel then uses them. */
const HANDLERS: FileHandlers = {
  recent: recentPaths,
  remember: rememberPath,
  pick: pickFile,
  exists: pathsExist,
  reveal: revealPath,
  contextMenu: pathFieldMenu,
}
registerFileHandlers(HANDLERS)

/**
 * A facets panel with a `file` field, wired to app-kit through `registerFileHandlers`. The "command"
 * is a function here: it refuses a non-image, which shows as the field's invalid message, and
 * accepts anything else, which the field sees as its value changing and then remembers.
 */
export function FileFieldDemo() {
  const [texture, setTexture] = useState<string | null>(null)
  const selection = useMemo(() => ({ texture }), [texture])
  const ctx = useMemo<Host>(
    () => ({
      write: (value) => {
        if (typeof value === "string" && !IMAGE.test(value)) {
          return { error: "Not an image: PNG, JPEG or WebP" }
        }
        setTexture(value as string | null)
      },
    }),
    [],
  )
  return (
    <div className="max-w-xl rounded-md border border-border">
      <PropertyPanel scopeKey={SCOPE} selection={selection} ctx={ctx} />
    </div>
  )
}
