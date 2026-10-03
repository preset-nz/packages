use tauri::Manager;

mod doc;
mod menu;
mod prefs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(doc::Doc::sample())
        // app-kit's close guard sees the main window's CloseRequested through this.
        .on_window_event(preset_app_kit::on_window_event)
        .setup(|app| {
            let path = preset_preferences::tauri::default_path(app.handle())?;
            app.manage(preset_preferences::Preferences::open(prefs::schema(), path));
            menu::install(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            doc::rhizome_rows,
            doc::rhizome_schema,
            doc::rhizome_set,
            doc::rhizome_reset,
            doc::effect_add,
            doc::effect_remove,
            doc::effect_move,
            doc::rhizome_gesture_begin,
            doc::rhizome_gesture_apply,
            doc::rhizome_gesture_end,
            doc::rhizome_gesture_cancel,
            preset_preferences::tauri::preferences_get,
            preset_preferences::tauri::preferences_set,
            preset_preferences::tauri::preferences_reset,
            preset_app_kit::app_kit_commands,
            preset_app_kit::app_kit_document,
            preset_app_kit::app_kit_menu_state,
            preset_app_kit::app_kit_history,
            preset_app_kit::app_kit_undo,
            preset_app_kit::app_kit_redo,
            preset_app_kit::app_kit_text_menu,
        ])
        .build(tauri::generate_context!())
        .expect("error while building the ux-kit playground")
        // Quits that skip the menu (the Dock's Quit, logging out) reach the guard here.
        .run(|app, event| preset_app_kit::on_run_event(app, &event));
}
