//! The playground's commands, declared for app-kit, which builds the native menu from them.
//!
//! Ids are shared with the toolbar (`src/app/MainApp.tsx` binds `run`, icon and gating to the same
//! ids); labels and accelerators are written here and nowhere else. Undo, Redo and Settings…
//! are built in. The Gallery and Settings windows are opened here; every other command is
//! forwarded to the main window as a `command` event.

use preset_app_kit::{shortcut, AppKit, Command, MenuName};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::doc::Doc;

/// Show a secondary window, creating it the first time. Same frontend, told apart by `?window=`.
fn open_window<R: Runtime>(app: &AppHandle<R>, label: &str, title: &str, size: (f64, f64)) {
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

/// The Effect menu for the Ops document: `Add ▸` grouped by each op's category, then Remove
/// and the reorder pair. Disabled until the webview enables them for the Ops document.
fn effect_commands() -> Vec<Command> {
    let add = crate::doc::EFFECTS.iter().map(|(kind, label, category)| {
        Command::item(&format!("effect.add.{kind}"), label)
            .domain("Effect")
            .section(0)
            .submenu("Add")
            .category(category)
            .tags([*category])
            .disabled()
    });
    add.chain([
        Command::item("effect.remove", "Remove Effect")
            .domain("Effect")
            .section(1)
            .disabled(),
        Command::item("effect.earlier", "Move Earlier")
            .accelerator(shortcut::MOVE_EARLIER)
            .domain("Effect")
            .section(2)
            .disabled(),
        Command::item("effect.later", "Move Later")
            .accelerator(shortcut::MOVE_LATER)
            .domain("Effect")
            .section(2)
            .disabled(),
    ])
    .collect()
}

pub fn commands() -> Vec<Command> {
    let mut commands = vec![
        Command::toggle("panel.left", "Show Outline")
            .toolbar_label("Outline")
            .accelerator("CmdOrCtrl+Alt+S")
            .menu(MenuName::View)
            .section(0),
        Command::toggle("panel.right", "Show Inspector")
            .toolbar_label("Inspector")
            .accelerator("CmdOrCtrl+Alt+I")
            .menu(MenuName::View)
            .section(0),
        Command::item("doc.reset", "Reset")
            .accelerator("CmdOrCtrl+Alt+R")
            .menu(MenuName::Edit)
            .disabled(),
        Command::item("view.theme", "Toggle Dark Mode")
            .accelerator("CmdOrCtrl+Shift+L")
            .menu(MenuName::View),
        Command::item("window.gallery", "Gallery")
            .accelerator("CmdOrCtrl+Shift+G")
            .menu(MenuName::Window),
    ];
    commands.extend(effect_commands());
    commands
}

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    AppKit::<R>::new("ux-kit playground")
        .settings()
        .file_type("Rhizome document", crate::doc::EXTENSION)
        .ask_to_save(|app| {
            crate::prefs::ask_to_save(
                app.try_state::<preset_preferences::Preferences>()
                    .as_deref(),
            )
        })
        .commands(commands())
        .on_command(|app, id| match id {
            "window.gallery" => {
                open_window(app, "gallery", "Gallery", (1000.0, 700.0));
                true
            }
            "app.settings" => {
                open_window(app, "settings", "Settings", (480.0, 360.0));
                true
            }
            _ => false,
        })
        .install::<Doc>(app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_ids_are_unique() {
        let cmds = commands();
        let mut ids: Vec<&str> = cmds.iter().map(|c| c.id()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), cmds.len());
    }
}
