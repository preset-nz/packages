//! Paths the user chose for a kind of file field ("texture", "font"): the last ten per key,
//! newest first, kept across documents in `recent-paths.json` in the app's data directory.
//!
//! This is the native half of ux-kit's `PathField`: the recent list behind its ▾, the Open
//! dialog behind its browse icon, Reveal in Finder, and the Missing check. Paths are stored and
//! returned exactly as given, never canonicalised, so a relative path stays relative. A relative
//! path resolves against a `base` directory (the document's folder) only to test it or reveal it.
//!
//! The pick does not remember what it returned. The app calls `app_kit_remember_path` once a
//! commit is accepted, so a typed or dropped path counts the same as a picked one, and a path
//! the app refused never enters the list.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::menu::{ContextMenu, Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, Runtime, Window};
use tauri_plugin_dialog::DialogExt;

/// How many paths a key keeps.
pub const LIMIT: usize = 10;

const FILE_NAME: &str = "recent-paths.json";

/// Load, change, store runs under this lock so two quick commits cannot lose one.
static STORE: Mutex<()> = Mutex::new(());

/// The recent paths of every key. Serialises as `{ "texture": ["a.png", …], … }`.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RecentPaths {
    keys: BTreeMap<String, Vec<String>>,
}

impl RecentPaths {
    /// The paths of one key, newest first. An unknown key is an empty list.
    pub fn list(&self, key: &str) -> &[String] {
        self.keys.get(key).map(Vec::as_slice).unwrap_or_default()
    }

    /// A path was chosen: it moves to the top of its key.
    pub fn note(&mut self, key: &str, path: &str) {
        let list = self.keys.entry(key.to_string()).or_default();
        list.retain(|p| p != path);
        list.insert(0, path.to_string());
        list.truncate(LIMIT);
    }

    /// Drop one path from one key.
    pub fn forget(&mut self, key: &str, path: &str) {
        if let Some(list) = self.keys.get_mut(key) {
            list.retain(|p| p != path);
            if list.is_empty() {
                self.keys.remove(key);
            }
        }
    }

    /// Read the lists from a file. A missing or corrupt file is empty.
    fn read(file: &Path) -> Self {
        fs::read(file)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    /// Write the lists. Failing loses only the ▾'s memory, so it is not reported.
    fn write(&self, file: &Path) {
        if let Some(dir) = file.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_vec_pretty(self) {
            let _ = fs::write(file, json);
        }
    }

    fn load<R: Runtime>(app: &AppHandle<R>) -> Self {
        store_path(app).map(|f| Self::read(&f)).unwrap_or_default()
    }

    fn store<R: Runtime>(&self, app: &AppHandle<R>) {
        if let Some(f) = store_path(app) {
            self.write(&f);
        }
    }
}

fn store_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(FILE_NAME))
}

/// Relative paths resolve against `base`; absolute ones stay as they are. With no base a
/// relative path resolves against the process's working directory, which is rarely meant.
fn resolve(path: &str, base: Option<&str>) -> PathBuf {
    let p = Path::new(path);
    match base {
        Some(b) if p.is_relative() => Path::new(b).join(p),
        _ => p.to_path_buf(),
    }
}

/// One file type in the Open dialog: `{ name: "Images", extensions: ["png", "jpg"] }`.
#[derive(Clone, Debug, Deserialize)]
pub struct PickFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// The recent paths for a field kind, newest first (at most ten). Paths that have gone are
/// still listed; the webview checks them with `app_kit_paths_exist`.
#[tauri::command]
pub fn app_kit_recent_paths<R: Runtime>(app: AppHandle<R>, key: String) -> Vec<String> {
    let _guard = STORE.lock().unwrap_or_else(|e| e.into_inner());
    RecentPaths::load(&app).list(&key).to_vec()
}

/// Put a path at the top of a field kind's recent list. The app calls this after it accepted
/// the commit, whether the path was picked, typed or dropped.
#[tauri::command]
pub fn app_kit_remember_path<R: Runtime>(app: AppHandle<R>, key: String, path: String) {
    let _guard = STORE.lock().unwrap_or_else(|e| e.into_inner());
    let mut recents = RecentPaths::load(&app);
    recents.note(&key, &path);
    recents.store(&app);
}

/// The native Open dialog. Returns the absolute path chosen, or `None` when cancelled. It does
/// not remember the pick. The dialog blocks, so it waits on a blocking-pool thread and the main
/// thread, which draws the panel, stays free.
#[tauri::command]
pub async fn app_kit_pick_file<R: Runtime>(
    app: AppHandle<R>,
    title: Option<String>,
    filters: Option<Vec<PickFilter>>,
    start_dir: Option<String>,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut panel = app.dialog().file();
        if let Some(title) = &title {
            panel = panel.set_title(title);
        }
        for f in filters.iter().flatten() {
            let ext: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
            panel = panel.add_filter(&f.name, &ext);
        }
        if let Some(dir) = start_dir.filter(|d| Path::new(d).is_dir()) {
            panel = panel.set_directory(dir);
        }
        panel
            .blocking_pick_file()
            .and_then(|p| p.into_path().ok())
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())
}

/// Show a file in the Finder (the platform's file manager elsewhere), selected. A relative
/// path resolves against `base`, a directory. Errors if the file is not there.
#[tauri::command]
pub fn app_kit_reveal_path(path: String, base: Option<String>) -> Result<(), String> {
    let full = resolve(&path, base.as_deref());
    if !full.exists() {
        return Err(format!("{} is missing", full.display()));
    }
    reveal(&full).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn reveal(path: &Path) -> std::io::Result<()> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
}

#[cfg(target_os = "windows")]
fn reveal(path: &Path) -> std::io::Result<()> {
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn reveal(path: &Path) -> std::io::Result<()> {
    let dir = path.parent().unwrap_or(path);
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map(|_| ())
}

/// Whether each path exists, in order. Relative paths resolve against `base`.
#[tauri::command]
pub fn app_kit_paths_exist(paths: Vec<String>, base: Option<String>) -> Vec<bool> {
    paths
        .iter()
        .map(|p| resolve(p, base.as_deref()).exists())
        .collect()
}

/// Menu item id of "Reveal in Finder" in the path field's context menu.
pub(crate) const PATH_MENU_REVEAL: &str = "app-kit.path-field.reveal";
/// Menu item id of "Clear" in the path field's context menu.
pub(crate) const PATH_MENU_CLEAR: &str = "app-kit.path-field.clear";

/// How long to wait for the menu event once the popup has closed. The event is queued behind the
/// popup's own tracking loop, so it arrives right after; a dismissed menu sends none.
const PATH_MENU_EVENT_WAIT: Duration = Duration::from_millis(400);

/// Where the open menu's choice goes. One menu is open at a time; a new one replaces the sender.
static PATH_MENU: Mutex<Option<Sender<&'static str>>> = Mutex::new(None);

#[cfg(target_os = "macos")]
const REVEAL_LABEL: &str = "Reveal in Finder";
#[cfg(target_os = "windows")]
const REVEAL_LABEL: &str = "Show in Explorer";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const REVEAL_LABEL: &str = "Show in File Manager";

/// The path field menu's items as `(id, label, enabled)`: Reveal is off when the file is
/// missing, Clear when there is nothing to clear.
fn path_menu_items(missing: bool, can_clear: bool) -> [(&'static str, &'static str, bool); 2] {
    [
        (PATH_MENU_REVEAL, REVEAL_LABEL, !missing),
        (PATH_MENU_CLEAR, "Clear", can_clear),
    ]
}

/// What a menu item id means to the webview: `"reveal"`, `"clear"`, or `None` for any other id.
fn path_menu_choice(id: &str) -> Option<&'static str> {
    match id {
        PATH_MENU_REVEAL => Some("reveal"),
        PATH_MENU_CLEAR => Some("clear"),
        _ => None,
    }
}

/// The app's menu-event handler offers every id here first. Returns true when the id is one of
/// the path field menu's (so it is not forwarded as an app command) and passes the choice to
/// the command waiting for it.
pub(crate) fn path_menu_chosen(id: &str) -> bool {
    let Some(choice) = path_menu_choice(id) else {
        return false;
    };
    if let Some(tx) = PATH_MENU.lock().unwrap_or_else(|e| e.into_inner()).take() {
        let _ = tx.send(choice);
    }
    true
}

/// Pop up the path field's native context menu at the pointer: Reveal in Finder (off when
/// `missing`) and Clear (off when `can_clear` is false; default on). Resolves to `"reveal"`,
/// `"clear"`, or `None` when the menu was dismissed. `PathField` hosts call it from their
/// `contextmenu` handler, unless the text is being edited, where the text menu belongs.
///
/// The popup blocks until the menu closes and the chosen item arrives as a menu event after
/// that, so the command waits on a blocking-pool thread and `app.on_menu_event` hands the
/// choice over through a channel.
#[tauri::command]
pub async fn app_kit_path_field_menu<R: Runtime>(
    window: Window<R>,
    missing: bool,
    can_clear: Option<bool>,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let app = window.app_handle();
        let [reveal, clear] = path_menu_items(missing, can_clear.unwrap_or(true));
        let reveal = MenuItem::with_id(app, reveal.0, reveal.1, reveal.2, None::<&str>)
            .map_err(|e| e.to_string())?;
        let clear = MenuItem::with_id(app, clear.0, clear.1, clear.2, None::<&str>)
            .map_err(|e| e.to_string())?;
        let rule = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
        let menu = Menu::with_items(app, &[&reveal, &rule, &clear]).map_err(|e| e.to_string())?;

        let (tx, rx) = mpsc::channel();
        *PATH_MENU.lock().unwrap_or_else(|e| e.into_inner()) = Some(tx);
        let shown = menu.popup(window);
        let choice = shown
            .is_ok()
            .then(|| rx.recv_timeout(PATH_MENU_EVENT_WAIT).ok())
            .flatten();
        // A dismissed menu leaves its sender behind; the next menu replaces it anyway.
        PATH_MENU.lock().unwrap_or_else(|e| e.into_inner()).take();
        shown.map_err(|e| e.to_string())?;
        Ok(choice.map(str::to_string))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noting_moves_to_the_top_without_repeats() {
        let mut r = RecentPaths::default();
        r.note("texture", "a.png");
        r.note("texture", "b.png");
        r.note("texture", "a.png");
        assert_eq!(r.list("texture"), ["a.png", "b.png"]);
    }

    #[test]
    fn a_key_keeps_the_newest_ten() {
        let mut r = RecentPaths::default();
        for i in 0..12 {
            r.note("texture", &format!("{i}.png"));
        }
        assert_eq!(r.list("texture").len(), LIMIT);
        assert_eq!(r.list("texture")[0], "11.png");
        assert_eq!(r.list("texture")[LIMIT - 1], "2.png");
    }

    #[test]
    fn keys_are_independent() {
        let mut r = RecentPaths::default();
        r.note("texture", "a.png");
        r.note("font", "b.ttf");
        r.forget("font", "b.ttf");
        assert_eq!(r.list("texture"), ["a.png"]);
        assert!(r.list("font").is_empty());
        assert!(r.list("nothing").is_empty());
    }

    #[test]
    fn paths_are_kept_as_given() {
        let mut r = RecentPaths::default();
        r.note("texture", "textures/../vellum.jpg");
        assert_eq!(r.list("texture"), ["textures/../vellum.jpg"]);
    }

    #[test]
    fn the_stored_shape_round_trips() {
        let mut r = RecentPaths::default();
        r.note("texture", "a.png");
        r.note("font", "/f/b.ttf");
        let json = serde_json::to_string(&r).unwrap();
        assert_eq!(json, r#"{"font":["/f/b.ttf"],"texture":["a.png"]}"#);
        assert_eq!(serde_json::from_str::<RecentPaths>(&json).unwrap(), r);
    }

    #[test]
    fn the_store_survives_a_relaunch_and_a_bad_file_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("data").join(FILE_NAME);
        assert_eq!(RecentPaths::read(&file), RecentPaths::default());
        let mut r = RecentPaths::default();
        r.note("texture", "a.png");
        r.write(&file);
        assert_eq!(RecentPaths::read(&file).list("texture"), ["a.png"]);
        fs::write(&file, b"not json").unwrap();
        assert_eq!(RecentPaths::read(&file), RecentPaths::default());
    }

    #[test]
    fn the_menu_items_follow_missing_and_empty() {
        let [reveal, clear] = path_menu_items(false, true);
        assert!(reveal.2 && clear.2);
        let [reveal, clear] = path_menu_items(true, true);
        assert!(!reveal.2 && clear.2);
        let [reveal, clear] = path_menu_items(false, false);
        assert!(reveal.2 && !clear.2);
    }

    #[test]
    fn a_menu_choice_reaches_the_waiting_command_and_other_ids_pass() {
        assert_eq!(path_menu_choice(PATH_MENU_REVEAL), Some("reveal"));
        assert_eq!(path_menu_choice(PATH_MENU_CLEAR), Some("clear"));
        assert_eq!(path_menu_choice("file.open"), None);
        assert!(!path_menu_chosen("file.open"));

        let (tx, rx) = mpsc::channel();
        *PATH_MENU.lock().unwrap() = Some(tx);
        assert!(path_menu_chosen(PATH_MENU_CLEAR));
        assert_eq!(rx.try_recv(), Ok("clear"));
        // With no menu waiting the id is still ours, and nothing panics.
        assert!(path_menu_chosen(PATH_MENU_REVEAL));
    }

    #[test]
    fn relative_paths_resolve_against_the_base() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("here.png"), b"x").unwrap();
        let base = dir.path().to_string_lossy().into_owned();
        let abs = dir.path().join("here.png").to_string_lossy().into_owned();
        let found = app_kit_paths_exist(
            vec!["here.png".into(), "gone.png".into(), abs.clone()],
            Some(base),
        );
        assert_eq!(found, [true, false, true]);
        // An absolute path ignores the base; a relative one with no base is not found here.
        assert_eq!(
            app_kit_paths_exist(vec![abs], Some("/nowhere".into())),
            [true]
        );
    }
}
