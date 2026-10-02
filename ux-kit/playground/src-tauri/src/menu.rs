//! The native menu bar. Rule 1 of `guidance/design/native-apps.md`: every command lives
//! here with its accelerator, and each item is forwarded to the webview as one event that
//! maps to one handler (see playground/src/menu.ts).

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::doc::{self, Doc, HistoryState};

/// The Edit > Undo / Redo items, kept so their titles and enabled state can follow the
/// tree's history.
pub struct HistoryItems<R: Runtime> {
    undo: MenuItem<R>,
    redo: MenuItem<R>,
}

fn title(verb: &str, label: &Option<String>) -> String {
    match label {
        Some(l) => format!("{verb} {l}"),
        None => verb.to_string(),
    }
}

/// Re-read the history from the tree and update Edit > Undo / Redo.
pub fn sync_history(app: &AppHandle) {
    let state = HistoryState::of(&app.state::<Doc>().0.lock().expect("tree lock"));
    if let Some(items) = app.try_state::<HistoryItems<tauri::Wry>>() {
        let _ = items.undo.set_text(title("Undo", &state.undo_label));
        let _ = items.undo.set_enabled(state.undo_label.is_some());
        let _ = items.redo.set_text(title("Redo", &state.redo_label));
        let _ = items.redo.set_enabled(state.redo_label.is_some());
    }
}

/// Menu item id to the event the webview listens for.
const EVENTS: &[(&str, &str)] = &[
    ("app-settings", "menu://app/settings"),
    ("view-toggle-theme", "menu://view/toggle-theme"),
    ("view-tokens", "menu://view/section/tokens"),
    ("view-primitives", "menu://view/section/primitives"),
    ("view-composites", "menu://view/section/composites"),
    ("view-native", "menu://view/section/native"),
];

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let name = "ux-kit playground";
    let about = AboutMetadata {
        name: Some(name.to_string()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };

    let settings = MenuItem::with_id(app, "app-settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let app_menu = Submenu::with_items(
        app,
        name,
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let undo = MenuItem::with_id(app, "edit-undo", "Undo", false, Some("CmdOrCtrl+Z"))?;
    let redo = MenuItem::with_id(app, "edit-redo", "Redo", false, Some("CmdOrCtrl+Shift+Z"))?;
    app.manage(HistoryItems { undo: undo.clone(), redo: redo.clone() });

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let toggle = MenuItem::with_id(app, "view-toggle-theme", "Toggle Dark Mode", true, Some("CmdOrCtrl+Shift+L"))?;
    let tokens = MenuItem::with_id(app, "view-tokens", "Tokens", true, Some("CmdOrCtrl+1"))?;
    let primitives = MenuItem::with_id(app, "view-primitives", "Primitives", true, Some("CmdOrCtrl+2"))?;
    let composites = MenuItem::with_id(app, "view-composites", "Composites", true, Some("CmdOrCtrl+3"))?;
    let native = MenuItem::with_id(app, "view-native", "Native", true, Some("CmdOrCtrl+4"))?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &tokens,
            &primitives,
            &composites,
            &native,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let menu = Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])?;
    app.set_menu(menu)?;

    sync_history(app);

    app.on_menu_event(|handle, event| {
        match event.id().0.as_str() {
            "edit-undo" => {
                let _ = doc::undo(handle);
            }
            "edit-redo" => {
                let _ = doc::redo(handle);
            }
            _ => {}
        }
        if let Some((_, evt)) = EVENTS.iter().find(|(id, _)| *id == event.id().0.as_str()) {
            let _ = handle.emit(evt, ());
        }
    });
    Ok(())
}
