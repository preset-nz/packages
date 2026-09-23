# preferences

Typed, versioned TOML preferences and a Cmd+, Settings window for Tauri apps
built with React.

An app declares a schema once, in Rust: sections, preference ids, kinds,
defaults. The crate owns the file, validates what it reads, saves atomically,
and exposes three Tauri commands and one change event. The npm package reads
that schema over the commands and renders the Settings window from it through
[`@preset.nz/facets`](https://github.com/preset-nz/facets), so an app never
hand-builds a settings dialog. Backends read values through the same handle
the commands use.

Two packages, one repo, one version:

| Path | Package | What it is |
|---|---|---|
| `src/` | `preset-preferences` (crate) | Schema, TOML store, `Preferences` handle, Tauri commands |
| `src-ts/` | `@preset.nz/preferences` (npm) | Hooks, `SettingsWindow`, `usePersistedState`, menu event helper |

Both ship as source. The crate is an ordinary Cargo dependency. The npm
package is unbuilt TypeScript that your bundler and `tsc` compile with your
own code, the same way `facets` works.

**Status:** 0.1.0, on crates.io and npm, consumed by Strata. The crate and
the npm package share one version and one `vX.Y.Z` tag. The TypeScript types
mirror the serde shape by hand, so use matching versions of both.

---

## The file

`<app config dir>/preferences.toml`, for example
`~/Library/Application Support/<bundle id>/preferences.toml` on macOS.
Sections are TOML tables and ids are `section.key`, so the file reads the way
you would write it by hand:

```toml
version = 1

[library]
retention_days = 30

[appearance]
theme = "system"
```

- A missing file means defaults. Nothing is written until the first change.
- A value that fails its kind (out of range, wrong type, not one of the
  options) drops to its default with a warning on stderr. Never a crash.
- Keys the schema does not know are kept and written back untouched, so an
  older build does not erase what a newer one wrote.
- `version` is the file version. Bump it when a stored value changes meaning.
- Saves write a sibling `.tmp` and rename over the target.

## Rust: installing

```toml
# src-tauri/Cargo.toml
[dependencies]
preset-preferences = { version = "0.1", features = ["tauri"] }
```

The `tauri` feature adds the commands and the change event. Without it the
crate is the schema and the store, with no Tauri dependency.

## Rust: declaring

```rust
use preset_preferences::{options, pref, section, Kind, Schema};

pub fn schema() -> Schema {
    Schema {
        version: 1,
        sections: vec![section("library", "Library"), section("appearance", "Appearance")],
        prefs: vec![
            pref("library.retention_days", "Keep deleted images for",
                 Kind::Int { min: Some(1), max: Some(365) }, 30)
                .help("Days before the Trash is emptied for good."),
            pref("appearance.theme", "Theme",
                 Kind::Select { options: options(&[
                     ("system", "System"), ("light", "Light"), ("dark", "Dark"),
                 ]) },
                 "system"),
        ],
    }
}
```

Kinds and how the window renders them:

| Kind | Value | Rendered as |
|---|---|---|
| `Bool` | `bool` | checkbox |
| `Int { min, max }` | `i64` | number, step 1 |
| `Float { min, max }` | `f64` | number |
| `Text` | `String` | text input |
| `Select { options }` | `String`, one of the options | select |
| `List` | `Vec<String>` | comma-separated line |
| `ReadonlyPath` | `String` | shown, selectable, not editable |

A schema is checked once at load: every id is `section.key`, every section is
declared, ids are unique, defaults pass their own kind. A bad declaration
panics, because it is a programming error.

## Rust: reading in the backend

```rust
use preset_preferences::Preferences;

let prefs = Preferences::open(schema(), path);
let days = prefs.get_int("library.retention_days").unwrap_or(30);
```

`Preferences` is `Clone` and thread-safe. Getters lock briefly and copy out,
so a background thread can read without holding anything. `set` and `reset`
validate, write memory and save in one step; on error nothing changes.

## Rust: Tauri

Enable the `tauri` feature, manage the handle as state, register the three
commands in your own `generate_handler!`:

```toml
preset-preferences = { version = "0.1", features = ["tauri"] }
```

```rust
let prefs = Preferences::open(schema(), preset_preferences::tauri::default_path(app.handle())?);
app.manage(prefs);

// in generate_handler![ ... ]:
preset_preferences::tauri::preferences_get,
preset_preferences::tauri::preferences_set,
preset_preferences::tauri::preferences_reset,
```

| Command | Args | Returns |
|---|---|---|
| `preferences_get` | none | `Snapshot` |
| `preferences_set` | `id`, `value` | `Snapshot`, or an error string |
| `preferences_reset` | `section?` | `Snapshot` |

Every write emits `preferences://changed` with the full `Snapshot`:
`{ schema, values, path }`. One event, whole state. Defaults ride inside the
schema, so the UI can mark changed values without a second call.

These are app-level commands, not a plugin, so no capability entries are
needed.

---

## TypeScript: installing

```sh
pnpm add @preset.nz/preferences @preset.nz/facets
```

Peers: React 19, `@tauri-apps/api` 2, `@preset.nz/facets`.

Because the package is unbuilt, your Vite config
must pin the shared runtime to your app's copies. Without this, Rollup
resolves `react` from the package's real location and fails, and two copies
of facets would mean two renderer registries:

```ts
// vite.config.ts
resolve: {
  alias: { "@": path.resolve(__dirname, "./src") },
  dedupe: ["react", "react-dom", "@tauri-apps/api", "@preset.nz/facets"],
}
```

Tailwind 4 does not scan outside your project, and a path-linked package
lives outside it, so name the packages in your CSS or their classes never
reach the build:

```css
@import "tailwindcss";
@source "../../../packages/facets/src";
@source "../../../packages/preferences/src-ts";
```

The window renders through facets, so the same five shadcn-shaped primitives
facets needs must exist at `@/components/ui/{input,label,checkbox,separator,select}`.
See the facets README for the exact exports. Nothing else is imported from
your app.

## TypeScript: using

Mount the window once near the root and open it from the native menu:

```tsx
import {
  onSettingsMenu,
  SettingsWindow,
  usePreferencesBootstrap,
} from "@preset.nz/preferences"

function App() {
  usePreferencesBootstrap()           // warm the snapshot before any window opens
  const [open, setOpen] = useState(false)
  useEffect(() => onSettingsMenu(() => setOpen(true)), [])
  return (
    <>
      <SettingsWindow open={open} onOpenChange={setOpen} title="Settings" />
      {/* the rest of the app */}
    </>
  )
}
```

`onSettingsMenu` listens for the event `menu://app/settings`. Your Rust menu
emits it from a `Settings…` item with the `CmdOrCtrl+,` accelerator; the
accelerator lives on the menu item, never as a keydown handler, or it
double-fires on macOS.

Read a value anywhere:

```tsx
import { usePreference } from "@preset.nz/preferences"

const theme = usePreference<string>("appearance.theme", "system")
```

`usePreferences()` gives the whole snapshot or `null` before the first load.
`usePreferenceActions()` returns `set(id, value)` and `reset(section?)`.
`currentPreferences()` is the non-hook read for menu handlers and the like.

The window saves on every change with no Save button, marks changed values
with a dot on the label, offers a reset per section and for everything, shows
each preference's help text, and prints the file path in its footer. Escape
closes it. It draws its own modal shell on the same Tailwind tokens facets
uses, so it needs no dialog primitive from your app.

## TypeScript: UI ephemera

```ts
import { usePersistedState } from "@preset.nz/preferences"

const [collapsed, setCollapsed] = usePersistedState("myapp.rail.collapsed", false)
```

`useState` that survives a relaunch, backed by localStorage, for things that
are neither a preference nor part of a document: collapsed sections, a panel
width, the last tab. Keys are `<app>.<surface>.<thing>` with the app prefix
mandatory. Every read and write is guarded, so a blocked or missing
localStorage just makes the app forgetful, not broken.

---

## Not in here

- **Override resolution.** A value resolving as preference, then document,
  then edit, with provenance. Planned for this crate; not started.
- **The native menu itself.** Each app builds the `Settings…` item by hand
  until a shared menu package exists.
- **A separate Tauri window.** The Settings window is a modal in the webview
  for now.

## Checks

```sh
just install   # cargo fetch, pnpm install
just check     # cargo check, test, clippy (all features); tsc on src-ts
```

`tsc` typechecks `src-ts/` against stand-in primitives in `dev/ui/`, the same
arrangement as facets. The authoritative check is that a consumer still
builds.

## Licence

MIT.
