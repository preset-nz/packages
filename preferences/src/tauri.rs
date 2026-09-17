//! Tauri commands and the change event.
//!
//! The app registers the three commands in its own `generate_handler!` and
//! manages a [`Preferences`] as state. App-level commands need no capability
//! entries, which is why this is not a Tauri plugin.
//!
//! ```ignore
//! tauri::Builder::default()
//!     .manage(prefs)
//!     .invoke_handler(tauri::generate_handler![
//!         preset_preferences::tauri::preferences_get,
//!         preset_preferences::tauri::preferences_set,
//!         preset_preferences::tauri::preferences_reset,
//!     ])
//! ```
//!
//! Every successful write emits `preferences://changed` with a full
//! [`Snapshot`]. One event, whole state; consumers re-read what they need.

use tauri::{AppHandle, Emitter, Runtime, State};

use crate::{Preferences, Snapshot, Value};

pub const CHANGED_EVENT: &str = "preferences://changed";

/// Resolve the conventional file location: `<app config dir>/preferences.toml`.
pub fn default_path<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<std::path::PathBuf> {
    use tauri::Manager;
    Ok(app.path().app_config_dir()?.join("preferences.toml"))
}

#[tauri::command]
pub fn preferences_get(prefs: State<'_, Preferences>) -> Snapshot {
    prefs.snapshot()
}

#[tauri::command]
pub fn preferences_set<R: Runtime>(
    app: AppHandle<R>,
    prefs: State<'_, Preferences>,
    id: String,
    value: Value,
) -> Result<Snapshot, String> {
    prefs.set(&id, value).map_err(|e| e.to_string())?;
    let snap = prefs.snapshot();
    let _ = app.emit(CHANGED_EVENT, &snap);
    Ok(snap)
}

#[tauri::command]
pub fn preferences_reset<R: Runtime>(
    app: AppHandle<R>,
    prefs: State<'_, Preferences>,
    section: Option<String>,
) -> Result<Snapshot, String> {
    prefs
        .reset(section.as_deref())
        .map_err(|e| e.to_string())?;
    let snap = prefs.snapshot();
    let _ = app.emit(CHANGED_EVENT, &snap);
    Ok(snap)
}
