# preset-preferences

Typed, versioned TOML preferences for the preset.nz desktop apps.

An app declares a schema: sections, preference ids, kinds, defaults. The crate
owns the file, validates what it reads, saves atomically, and exposes three
Tauri commands and one event so the frontend can read, write and follow
changes. Backends read values through the same handle.

Part of the [Tauri scaffold](https://github.com/preset-nz) alongside
`@preset.nz/facets`, which renders the Settings window from this schema.

## The file

`<app config dir>/preferences.toml`. Sections are TOML tables, ids are
`section.key`, so it reads the way you would write it by hand:

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
- Saves write a sibling `.tmp` and rename over the target.

## Declaring

```rust
use preset_preferences::{options, pref, section, Kind, Preferences, Schema};

fn schema() -> Schema {
    Schema {
        version: 1,
        sections: vec![section("library", "Library"), section("appearance", "Appearance")],
        prefs: vec![
            pref("library.retention_days", "Keep deleted images for",
                 Kind::Int { min: Some(1), max: Some(365) }, 30)
                .help("Days before the Trash is emptied for good."),
            pref("appearance.theme", "Theme",
                 Kind::Select { options: options(&[("system", "System"), ("light", "Light"), ("dark", "Dark")]) },
                 "system"),
        ],
    }
}
```

Kinds: `Bool`, `Int { min, max }`, `Float { min, max }`, `Text`,
`Select { options }`, `List` (of strings), `ReadonlyPath`.

## Reading in the backend

```rust
let prefs = Preferences::open(schema(), path);
let days = prefs.get_int("library.retention_days").unwrap_or(30);
```

`Preferences` is `Clone` and thread-safe. Getters lock briefly and copy out.

## Tauri

Enable the `tauri` feature, manage the handle as state, register the commands:

```rust
let prefs = Preferences::open(schema(), preset_preferences::tauri::default_path(&handle)?);
app.manage(prefs);
// in generate_handler!:
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
`{ schema, values, path }`. Defaults ride inside the schema, so the UI can
mark changed values without a second call.

These are app-level commands, not a plugin, so no capability entries are
needed.

## Not in here

Override resolution (preference, then document, then edit) is planned and
will live in this crate, driven by Shard. The Settings window and the React
hooks are the npm package `@preset.nz/preferences` in this repo.

## Checks

```sh
just check   # cargo check, test, clippy with all features
```

MIT.
