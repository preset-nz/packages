//! The README's recipe, from outside the crate: an app names the models commands at the crate
//! root, where `#[tauri::command]` puts the helper macros `generate_handler!` needs.
#![cfg(feature = "models")]

#[test]
fn models_commands_register_at_the_crate_root() {
    let _ = tauri::test::mock_builder().invoke_handler(tauri::generate_handler![
        preset_app_kit::app_kit_models_list,
        preset_app_kit::app_kit_models_download,
        preset_app_kit::app_kit_models_cancel,
        preset_app_kit::app_kit_models_remove,
        preset_app_kit::app_kit_models_path,
    ]);
}
