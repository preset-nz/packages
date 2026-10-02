//! The native menu bar. Rule 1 of `guidance/design/native-apps.md`: every command lives
//! here with its accelerator.
//!
//! Menu item ids are the command ids of `playground/src/commands.ts`, the same ids the
//! toolbar uses. Undo, redo and opening windows are handled here; every other command is
//! forwarded to the main window as a `command` event whose payload is the id. The webview
//! pushes enabled and checked state back through `menu_state`.
//! Accelerators are written here (the menu is built before the webview exists) and as
//! display strings in commands.ts; keep the two in step.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{
    AboutMetadata, CheckMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewUrl, WebviewWindowBuilder};

use crate::doc::{self, Doc, HistoryState};

/// Whether a text field has focus in the webview (reported through `menu_state`). While it
/// does, Edit > Undo/Redo belong to the field's typing, not the document. See textUndo.ts.
#[derive(Default)]
pub struct TextFocus(AtomicBool);

/// Every command item by id, so `menu_state` can reach it.
pub struct Items<R: Runtime>(Mutex<HashMap<String, MenuItemKind<R>>>);

fn title(verb: &str, label: &Option<String>) -> String {
    match label {
        Some(l) => format!("{verb} {l}"),
        None => verb.to_string(),
    }
}

/// Re-read the history from the tree and update Edit > Undo / Redo.
pub fn sync_history(app: &AppHandle) {
    let state = HistoryState::of(&app.state::<Doc>().0.lock().expect("tree lock"));
    let text = app.state::<TextFocus>().0.load(Ordering::Relaxed);
    if let Some(items) = app.try_state::<Items<tauri::Wry>>() {
        let items = items.0.lock().expect("menu items lock");
        if let Some(undo) = items.get("edit.undo").and_then(|i| i.as_menuitem()) {
            let _ = undo.set_text(if text {
                "Undo".into()
            } else {
                title("Undo", &state.undo_label)
            });
            let _ = undo.set_enabled(text || state.undo_label.is_some());
        }
        if let Some(redo) = items.get("edit.redo").and_then(|i| i.as_menuitem()) {
            let _ = redo.set_text(if text {
                "Redo".into()
            } else {
                title("Redo", &state.redo_label)
            });
            let _ = redo.set_enabled(text || state.redo_label.is_some());
        }
    }
}

#[derive(Deserialize)]
pub struct CommandState {
    id: String,
    enabled: Option<bool>,
    checked: Option<bool>,
}

/// The webview's command table, as it stands: enabled and checked state per command id.
/// Undo and redo are not sent; they follow the tree's history (`sync_history`).
#[tauri::command]
pub fn menu_state(
    app: AppHandle,
    items: State<'_, Items<tauri::Wry>>,
    focus_state: State<'_, TextFocus>,
    states: Vec<CommandState>,
    text_focus: Option<bool>,
) {
    if let Some(t) = text_focus {
        focus_state.0.store(t, Ordering::Relaxed);
        sync_history(&app);
    }
    let items = items.0.lock().expect("menu items lock");
    for s in states {
        match items.get(&s.id) {
            Some(MenuItemKind::MenuItem(i)) => {
                if let Some(e) = s.enabled {
                    let _ = i.set_enabled(e);
                }
            }
            Some(MenuItemKind::Check(i)) => {
                if let Some(e) = s.enabled {
                    let _ = i.set_enabled(e);
                }
                if let Some(c) = s.checked {
                    let _ = i.set_checked(c);
                }
            }
            _ => {}
        }
    }
}

/// Show a secondary window, creating it the first time. Same frontend, told apart by `?window=`.
fn open_window(app: &AppHandle, label: &str, title: &str, size: (f64, f64)) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let url = WebviewUrl::App(format!("index.html?window={label}").into());
    let _ = WebviewWindowBuilder::new(app, label, url)
        .title(title)
        .inner_size(size.0, size.1)
        .build();
}

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let name = "ux-kit playground";
    let about = AboutMetadata {
        name: Some(name.to_string()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };
    let mut items: HashMap<String, MenuItemKind<tauri::Wry>> = HashMap::new();

    let mut plain = |id: &str,
                     text: &str,
                     enabled: bool,
                     accel: Option<&str>|
     -> tauri::Result<MenuItem<tauri::Wry>> {
        let item = MenuItem::with_id(app, id, text, enabled, accel)?;
        items.insert(id.to_string(), MenuItemKind::MenuItem(item.clone()));
        Ok(item)
    };
    let settings = plain("app.settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let undo = plain("edit.undo", "Undo", false, Some("CmdOrCtrl+Z"))?;
    let redo = plain("edit.redo", "Redo", false, Some("CmdOrCtrl+Shift+Z"))?;
    let reset = plain("doc.reset", "Reset", false, Some("CmdOrCtrl+Alt+R"))?;
    let theme = plain(
        "view.theme",
        "Toggle Dark Mode",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let gallery = plain("window.gallery", "Gallery", true, Some("CmdOrCtrl+Shift+G"))?;

    let check = |id: &str, text: &str, accel: &str| -> tauri::Result<CheckMenuItem<tauri::Wry>> {
        CheckMenuItem::with_id(app, id, text, true, true, Some(accel))
    };
    let left = check("panel.left", "Show Outline", "CmdOrCtrl+Alt+S")?;
    let right = check("panel.right", "Show Inspector", "CmdOrCtrl+Alt+I")?;
    items.insert("panel.left".into(), MenuItemKind::Check(left.clone()));
    items.insert("panel.right".into(), MenuItemKind::Check(right.clone()));
    app.manage(Items(Mutex::new(items)));
    app.manage(TextFocus::default());

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

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&PredefinedMenuItem::close_window(app, None)?],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &reset,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &left,
            &right,
            &PredefinedMenuItem::separator(app)?,
            &theme,
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
            &gallery,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
    )?;
    app.set_menu(menu)?;

    sync_history(app);

    app.on_menu_event(|handle, event| match event.id().0.as_str() {
        id @ ("edit.undo" | "edit.redo") => {
            let undo = id == "edit.undo";
            if handle.state::<TextFocus>().0.load(Ordering::Relaxed) {
                // A text field has focus: the webview runs execCommand on it.
                let target = handle
                    .webview_windows()
                    .into_iter()
                    .find(|(_, w)| w.is_focused().unwrap_or(false))
                    .map_or("main".to_string(), |(label, _)| label);
                let _ = handle.emit_to(target, "text-undo", if undo { "undo" } else { "redo" });
            } else if undo {
                let _ = doc::undo(handle);
            } else {
                let _ = doc::redo(handle);
            }
        }
        "window.gallery" => open_window(handle, "gallery", "Gallery", (1000.0, 700.0)),
        "app.settings" => open_window(handle, "settings", "Settings", (480.0, 360.0)),
        id => {
            let _ = handle.emit_to("main", "command", id);
        }
    });
    Ok(())
}
