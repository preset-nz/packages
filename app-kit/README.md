# app-kit

The behaviour of a desktop app, shared across the preset.nz family: one command table feeding the native menu and the toolbar, Undo and Redo that say what they undo, Cmd+Z that never fights a text field, and a small selection store. [`ux-kit`](https://github.com/preset-nz/ux-kit) holds the look; app-kit holds how the app acts.

An app declares its commands in Rust and plugs in its history. app-kit builds the menu bar, keeps Undo and Redo titled and gated, and hands the same table to the webview, so a label or an accelerator is written once.

Two packages, one repo, one version:

| Path | Package | What it is |
|---|---|---|
| `src/` | `preset-app-kit` (crate) | Command table, menu builder, `History` trait, Tauri commands |
| `src-ts/` | `@preset.nz/app-kit` (npm) | `useCommands`, toolbar bridge, history hook, text-field undo, selection store |

Pre-1.0: a minor version can break things, a patch never does. Crate and npm versions move together, and the TypeScript types mirror the serde shape by hand.

The toolbar bridge renders ux-kit's `ToolbarItems`, so ux-kit is an optional peer; `@preset.nz/app-kit/core` needs none of it. ux-kit never depends on app-kit. Neither depends on rhizome: each app adapts its own history to the trait.

## Rust

```rust
use preset_app_kit::{AppKit, Command, History, MenuName};

impl History for Doc { /* undo_label, redo_label, undo_labels, redo_labels, undo, redo */ }

tauri::Builder::default()
    .manage(Doc::new())
    .setup(|app| {
        AppKit::<tauri::Wry>::new("My App")
            .settings() // opt in: Settings… with Cmd+,
            .commands([
                Command::toggle("panel.left", "Show Outline")
                    .accelerator("CmdOrCtrl+Alt+S")
                    .toolbar_label("Outline")
                    .menu(MenuName::View)
                    .section(0),
                Command::item("doc.reset", "Reset").accelerator("CmdOrCtrl+Alt+R").disabled(),
            ])
            .on_command(|app, id| match id { "app.settings" => { /* open it */ true } _ => false })
            .install::<Doc>(app.handle())?; // Doc is the managed History
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        preset_app_kit::app_kit_commands,
        preset_app_kit::app_kit_menu_state,
        preset_app_kit::app_kit_history,
        preset_app_kit::app_kit_undo,
        preset_app_kit::app_kit_redo,
        preset_app_kit::app_kit_text_menu,
    ])
```

- **Models (cargo feature `models`)**: `preset_app_kit::models::install(app.handle(), "nz.preset.myapp", "My App", REGISTRY)` in `setup` (separate from `AppKit::install`). Call it from the synchronous `setup`, never from async code: the downloader is reqwest's blocking client, which panics on a tokio worker thread. It manages the store, writes `.users/<bundle-id>.json`, sweeps stale `.part` files and emits `app-kit://models` (`{ id, status }`, at most four a second per download, plus every status change). It returns the `ModelStore`; `store.path("mobile_sam")` gives a sidecar its `model_dir`. Add the commands beside the others:

  ```rust
  preset_app_kit::app_kit_models_list,
  preset_app_kit::app_kit_models_download,
  preset_app_kit::app_kit_models_cancel,
  preset_app_kit::app_kit_models_remove,
  preset_app_kit::app_kit_models_path,
  ```

  `status` is a tagged object (`{ "kind": "downloading", "done": 1, "total": 2 }`). The list includes models this app never declared (from their manifests), and any of them can be removed. The webview never receives a URL.
  In the Settings window of `@preset.nz/preferences` (app-kit depends on neither it nor facets, so these lines live in the app): `registerFieldRenderer("models", () => <ModelsSection />)`, then `<SettingsWindow extraGroups={[{ page: "general", group: { id: "models", title: "Models", rows: [{ kind: "models", id: "models" }] } }]} />` with the array at module scope. The recipe is in preferences' README.
- **`Command`**: id, menu label, optional toolbar label, Tauri accelerator, `MenuName` (App, File, Edit, View, Window, Help), `section` (items in a section sit together), item or toggle. Undo and Redo are built in; Settings is opt-in.
- **File menu**: New, Open…, Open Recent ▸, Close, Save, Save As… and Revert to Saved… are built in, run against the app's `Document` behind the close guard. Revert is enabled only for an unsaved document with a file, and asks first, because reloading starts an empty history. Open Recent keeps ten documents, newest first, in `recent-documents.json` in the app's data directory; a file that has gone says so and leaves the list. `note_recent(app, path)` adds a document opened some other way (from the Finder), and `recent_documents(app)[0]` is the last document. `.documents_folder(|app| …)` names where the Open and Save panels start for an Untitled document (`~/preset-nz/<App>/…`); the app supplies the lookup, so app-kit doesn't depend on app-folders.
- **Relaunch**: the app starts on a fresh Untitled document; it does not reopen the last one (that is File > Open Recent's first entry). `.plugin(preset_app_kit::window_state())` on the builder brings each window back at its size and position (`tauri-plugin-window-state`, not visibility). `on_run_event` opens a document the Finder hands over (double-click, `open some.x`, the Dock). For an app with documents, app-kit owns Finder opens, so don't add a second handler.
- **Menu config**: `.menu_config(include_str!("../menu.toml"))` switches the built-in items on and off: `[file] new, open, open_recent, close, save, save_as, revert` and `[app] settings`. A missing key takes the default (on); an unknown key is an error, so add a test that calls `MenuConfig::parse` on your file. Labels, accelerators and positions stay the standard's. Design: guidance `projects/app-kit/design/menu-config.md`.
- **Apps without documents**: `install_history::<H: History>` instead of `install::<H: Document>`, for a library such as Strata. The config must turn New, Open, Open Recent, Save, Save As and Revert off; with Close off too, Window gains Close Window on Cmd+W. No close guard, no window-title handling, and it doesn't register `tauri-plugin-dialog`, so the app keeps its own.
- **`History`**: `undo_label`, `redo_label`, `undo_labels` (oldest first), `redo_labels` (next first), `undo`, `redo`. Implement it on the type you manage as Tauri state. The reads may lock, so call `refresh_history(app)` after a change and never while holding that lock.
- **`edit_titles`**: the pure rule behind Edit > Undo: "Undo Set Opacity" when there is a step, plain and disabled when there is none, plain and enabled while a text field has focus.
- **Events**: `command` (id, to the main window), `text-undo` (to the focused window), `app-kit://history` (a `HistoryState`), `app-kit://document` (a `DocumentState`), `app-kit://note` (a string).
- Commands are plain Tauri commands, not a plugin, so no capability entries are needed.

## TypeScript

```tsx
import { CommandToolbar, useCommands, nativeContextMenu } from "@preset.nz/app-kit"

const { commands, run, shortcut } = useCommands(bindings) // bindings: Record<id, { icon, run, enabled, pressed, ... }>
<CommandToolbar commands={commands} layout={{ leading: ["panel.left"], groups: [["edit.undo", "edit.redo"]] }} run={run} />
```

- **`useCommands(bindings)`**: loads the table from Rust, binds `run`, icon and gating by id, follows the history, routes text-field undo and keeps the menu's enabled and checked state in step. `edit.undo` and `edit.redo` need only an icon. `bindCommands`, `useCommandTable`, `useMenuSync`, `toItems` are the parts.
- **`CommandToolbar`**: ux-kit's `ToolbarItems` fed from the commands.
- **`@preset.nz/app-kit/core`**: everything except `CommandToolbar` and `toItems`, with no ux-kit import, for apps that use only the menu half. ux-kit is an optional peer.
- **`useDocument`**: the live `DocumentState`.
- **`useHistory`, `undo`, `redo`**: the live `HistoryState`, and the same undo the menu takes. The Inspector's History list reads `undoLabels` and `redoLabels`.
- **`useTextUndo`, `useTextFocus`, `isTextField`, `blurField`**: Cmd+Z undoes typing while a text field has focus, the document otherwise.
- **`createSelection<T>(none)`**: single-select store with `get`, `use`, `select`, `clear`. **`createMultiSelection<T>(key)`**: the opt-in multi-select. **`createStore`, `useStore`**: the small store under both. Wrap them in your own narrow setters; there is no `setSelection`, and selection is not an undo step.
- **`nativeContextMenu()`**: no WebKit context menu. Right-click in a text field pops up a short native menu (Undo, Redo, Cut, Copy, Paste, Select All; needs `app_kit_text_menu` registered); elsewhere nothing, and app-drawn menus still open.

- **Recent paths and the native pieces of `PathField`** (ux-kit): register `app_kit_recent_paths`, `app_kit_remember_path`, `app_kit_pick_file`, `app_kit_reveal_path`, `app_kit_paths_exist` and `app_kit_path_field_menu` in `generate_handler!`; `tauri-plugin-dialog` must be registered (`AppKit::install` does). TypeScript: `recentPaths(key)`, `rememberPath(key, path)`, `pickFile({ title, filters, startDir })`, `revealPath(path, base?)`, `pathsExist(paths, base?)` and `useMissingCheck(paths, base?)`, which re-checks on window focus and returns `boolean[]` (true = missing). Each key (`"texture"`, `"font"`) keeps its last 10 paths, newest first, in `recent-paths.json` in the app's data directory, shared across documents. Paths are stored as written, never canonicalised; relative ones resolve against `base` (the document's folder) only to test or reveal them. `pickFile` returns the absolute path or `null` and does **not** remember it: call `rememberPath` after the app has accepted the commit, so typed and dropped paths count and refused ones don't. The dialog runs on a blocking-pool thread, off the main thread. Reveal is `open -R` on macOS (Explorer `/select,` on Windows, `xdg-open` on the folder elsewhere) and errors for a missing file. `pathFieldMenu({ missing, canClear? })` pops a native menu at the pointer (Reveal in Finder, off when missing; Clear) and resolves to `"reveal"`, `"clear"` or `null`; the caller acts on it, and skips it while the text is being edited so the text menu stays. The popup blocks until it closes and the chosen item reaches the command as a menu event through `AppKit`'s `on_menu_event`, so the menu needs `AppKit::install`.

- **Dropping a file on a `PathField`**: call `installPathDrop()` once at startup (`void installPathDrop()` in `main.tsx`; it resolves to the unlisten function, and a second call returns the same subscription). The window needs `"dragDropEnabled": true` (Tauri's default), because HTML5 drop events carry no real paths: Tauri reports OS drops as webview drag-drop events, and `installPathDrop` hit-tests their position to the `[data-slot="path-field"]` under the pointer. While a drag is over a field it carries a `data-drop-target` attribute (ux-kit draws the ring); when the file lands the field gets a `path-drop` `CustomEvent` (`detail: { path }`, first file only) and commits it through `onCommit`, like a pick, so `rememberPath` still follows the host's acceptance. A drop anywhere else is ignored. ux-kit's `PATH_DROP_EVENT` and `PATH_DROP_TARGET_ATTRIBUTE` are the contract; app-kit/core cannot import ux-kit, so `drop-target.ts` repeats the strings and a facets test pins the two together. Tauri's drop position is physical pixels on Windows but already CSS pixels on macOS and Linux (checked in wry 0.57), so only Windows is divided by `devicePixelRatio`. **Turning `dragDropEnabled` on makes the native layer take file drags**: on Windows it replaces WebView2's drag handler and breaks HTML5 drag and drop inside the page, so an app that uses `draggable`/`onDrop` internally (Strata) keeps it off and either does without field drops or moves its in-page drags to pointer events first.

The table arrives from Rust. Apps run only in their Tauri window; a plain browser tab is not a supported host.

## Consuming it

```toml
# src-tauri/Cargo.toml
preset-app-kit = "0.1"
```

```sh
pnpm add @preset.nz/app-kit
```

`@preset.nz/app-kit/core` is everything except the toolbar, for an app that doesn't use ux-kit; ux-kit is an optional peer.

In Vite, add `@preset.nz/app-kit` (with `react`, `react-dom`, `@tauri-apps/api`, `@preset.nz/ux-kit`) to `resolve.dedupe`; a second copy of React fails only in the window. app-kit ships no Tailwind classes, so it needs no `@source` line.

## Development

`just check` runs `cargo fmt --check`, clippy, `cargo test`, `tsc` and Biome. MIT.
