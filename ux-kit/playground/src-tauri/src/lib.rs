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
        .invoke_handler(tauri::generate_handler![doc::rhizome_rows])
        .run(tauri::generate_context!())
        .expect("error while running the ux-kit playground");
}
