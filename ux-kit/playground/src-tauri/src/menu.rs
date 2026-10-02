//! The native menu bar. Rule 1 of `guidance/design/native-apps.md`: every command lives
//! here with its accelerator, and each item is forwarded to the webview as one event that
//! maps to one handler (see playground/src/menu.ts).

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

/// Menu item id to the event the webview listens for.
const EVENTS: &[(&str, &str)] = &[
    ("app-settings", "menu://app/settings"),
    ("view-toggle-theme", "menu://view/toggle-theme"),
    ("view-tokens", "menu://view/section/tokens"),
    ("view-primitives", "menu://view/section/primitives"),
    ("view-composites", "menu://view/section/composites"),
    ("view-native", "menu://view/section/native"),
];

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
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

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
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

    app.on_menu_event(|handle, event| {
        if let Some((_, evt)) = EVENTS.iter().find(|(id, _)| *id == event.id().0.as_str()) {
            let _ = handle.emit(evt, ());
        }
    });
    Ok(())
}
