mod doc;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(doc::Doc::sample())
        .setup(|app| {
            menu::install(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            doc::rhizome_rows,
            doc::rhizome_schema,
            doc::rhizome_set,
            doc::rhizome_reset,
            doc::rhizome_gesture_begin,
            doc::rhizome_gesture_apply,
            doc::rhizome_gesture_end,
            doc::rhizome_gesture_cancel,
            preset_app_kit::app_kit_commands,
            preset_app_kit::app_kit_menu_state,
            preset_app_kit::app_kit_history,
            preset_app_kit::app_kit_undo,
            preset_app_kit::app_kit_redo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the ux-kit playground");
}
