//! The webview's side of models: five Tauri commands and one event.
//!
//! Like the rest of app-kit this is not a plugin: the app lists the commands in its own
//! `generate_handler!`, so no capability entries are needed. The webview never gets a URL; it
//! gets a path only from [`app_kit_models_path`], for an app that must hand it to a backend.

use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use super::download::{Downloader, HttpDownloader};
use super::registry::ModelSpec;
use super::store::{ModelError, ModelInfo, ModelStatus, ModelStore};

/// The event that says a model changed. Its payload is a [`ModelChange`]. A download sends it at
/// most four times a second, and once on every status change.
pub const MODELS_EVENT: &str = "app-kit://models";

/// The payload of [`MODELS_EVENT`]: the model that changed and where it stands now.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelChange {
    pub id: String,
    pub status: ModelStatus,
}

/// Turn the models on for this app: create the store on the machine-wide folder, manage it as
/// Tauri state, record which models this app uses (`declare_use`), run the start-up cleanup, and
/// emit [`MODELS_EVENT`] as models change. Returns the store, so the app can call `path(id)` from
/// its own Rust (to hand `model_dir` to a sidecar).
///
/// Independent of `AppKit::install`: models need neither a document nor a menu.
pub fn install<R: Runtime>(
    app: &AppHandle<R>,
    bundle_id: &str,
    app_name: &str,
    registry: impl Into<Vec<ModelSpec>>,
) -> Result<ModelStore, ModelError> {
    install_with(
        app,
        bundle_id,
        app_name,
        registry,
        Arc::new(HttpDownloader::new()),
    )
}

/// [`install`] with the downloader chosen by the caller (tests pass a fake).
pub fn install_with<R: Runtime>(
    app: &AppHandle<R>,
    bundle_id: &str,
    app_name: &str,
    registry: impl Into<Vec<ModelSpec>>,
    downloader: Arc<dyn Downloader>,
) -> Result<ModelStore, ModelError> {
    let store = ModelStore::for_app(app, registry, downloader)?;
    wire(app, &store, bundle_id, app_name)?;
    Ok(store)
}

/// Manage `store`, observe it into the event, declare use and clean up. Split out so a test can
/// give the store a temp-dir root.
pub(crate) fn wire<R: Runtime>(
    app: &AppHandle<R>,
    store: &ModelStore,
    bundle_id: &str,
    app_name: &str,
) -> Result<(), ModelError> {
    let handle = app.clone();
    let watched = store.clone();
    store.on_change(move |id| {
        let change = ModelChange {
            id: id.to_string(),
            status: watched.status(id),
        };
        let _ = handle.emit(MODELS_EVENT, change);
    });
    store.declare_use(bundle_id, app_name)?;
    store.clean_up();
    app.manage(store.clone());
    Ok(())
}

/// Every installed or declared model: status, sizes, licence, host and the other apps using it.
#[tauri::command]
pub fn app_kit_models_list(store: State<'_, ModelStore>) -> Vec<ModelInfo> {
    store.list()
}

/// Start the download and return at once; progress arrives on [`MODELS_EVENT`].
#[tauri::command]
pub fn app_kit_models_download(store: State<'_, ModelStore>, id: String) -> Result<(), String> {
    store.download(&id).map_err(|e| e.to_string())
}

/// Cancel a running download. Does nothing when the model isn't downloading.
#[tauri::command]
pub fn app_kit_models_cancel(store: State<'_, ModelStore>, id: String) {
    store.cancel(&id);
}

/// Delete an installed model. An error string when refused (it is downloading).
#[tauri::command]
pub fn app_kit_models_remove(store: State<'_, ModelStore>, id: String) -> Result<(), String> {
    store.remove(&id).map_err(|e| e.to_string())
}

/// The model's folder, for a backend that reads the files; an error naming the model when it
/// isn't installed.
#[tauri::command]
pub fn app_kit_models_path(store: State<'_, ModelStore>, id: String) -> Result<String, String> {
    store
        .path(&id)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FileSpec;
    use sha2::{Digest, Sha256};
    use std::fs;
    use std::path::Path;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};
    use tauri::Listener;

    use super::super::download::DownloadError;

    const A: &[u8] = b"the bytes of model a, enough of them to chunk into many steps";
    const B: &[u8] = b"model b is held mid-download so that it can be cancelled by a test";

    fn hex(bytes: &[u8]) -> &'static str {
        let s: String = Sha256::digest(bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        Box::leak(s.into_boxed_str())
    }

    fn spec(id: &'static str, url: &'static str, bytes: &[u8]) -> ModelSpec {
        let files: &'static [FileSpec] = Box::leak(Box::new([FileSpec {
            name: "w.bin",
            url,
            sha256: hex(bytes),
            size: bytes.len() as u64,
        }]));
        ModelSpec {
            id,
            label: id,
            used_by: "tests",
            licence: "MIT",
            host: "example.test",
            files,
        }
    }

    /// Writes 1-byte steps; a url ending in `hold` waits for cancel.
    struct Fake;

    impl Downloader for Fake {
        fn fetch(
            &self,
            url: &str,
            dest: &Path,
            progress: &mut dyn FnMut(u64),
            cancel: &AtomicBool,
        ) -> Result<(), DownloadError> {
            let bytes = if url == "u://a" { A } else { B };
            let mut out = Vec::new();
            for b in bytes {
                // b writes its first byte, then waits to be cancelled.
                while url == "u://b" && !out.is_empty() && !cancel.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(1));
                }
                if cancel.load(Ordering::Relaxed) {
                    return Err(DownloadError::Cancelled);
                }
                out.push(*b);
                fs::write(dest, &out).unwrap();
                progress(out.len() as u64);
            }
            Ok(())
        }
    }

    struct Rig {
        app: tauri::App<tauri::test::MockRuntime>,
        events: Arc<Mutex<Vec<(Instant, serde_json::Value)>>>,
        _root: tempfile::TempDir,
        root: std::path::PathBuf,
    }

    fn rig() -> Rig {
        let app = tauri::test::mock_app();
        let root = tempfile::tempdir().unwrap();
        let path = root.path().to_path_buf();
        let store = ModelStore::with_root(
            &path,
            vec![spec("a", "u://a", A), spec("b", "u://b", B)],
            Arc::new(Fake),
        );
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        app.listen(MODELS_EVENT, move |e| {
            let v = serde_json::from_str(e.payload()).unwrap();
            sink.lock().unwrap().push((Instant::now(), v));
        });
        wire(app.handle(), &store, "nz.preset.test", "Test").unwrap();
        Rig {
            app,
            events,
            root: path,
            _root: root,
        }
    }

    impl Rig {
        fn store(&self) -> State<'_, ModelStore> {
            self.app.state::<ModelStore>()
        }

        fn kinds(&self, id: &str) -> Vec<String> {
            self.events
                .lock()
                .unwrap()
                .iter()
                .filter(|(_, v)| v["id"] == id)
                .map(|(_, v)| v["status"]["kind"].as_str().unwrap().to_string())
                .collect()
        }

        fn wait(&self, id: &str, kind: &str) {
            let start = Instant::now();
            while self.kinds(id).last().map(String::as_str) != Some(kind) {
                assert!(
                    start.elapsed() < Duration::from_secs(5),
                    "no {kind} for {id}"
                );
                std::thread::sleep(Duration::from_millis(2));
            }
        }
    }

    #[test]
    fn list_download_cancel_and_remove_through_the_commands() {
        let rig = rig();
        let rows = app_kit_models_list(rig.store());
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].id, "a");
        assert_eq!(rows[0].status, ModelStatus::NotInstalled);
        assert!(app_kit_models_path(rig.store(), "a".into()).is_err());

        app_kit_models_download(rig.store(), "a".into()).unwrap();
        rig.wait("a", "ready");
        let kinds = rig.kinds("a");
        assert_eq!(kinds.first().map(String::as_str), Some("downloading"));
        assert_eq!(kinds.last().map(String::as_str), Some("ready"));
        let rows = app_kit_models_list(rig.store());
        assert_eq!(rows[0].status, ModelStatus::Ready);
        assert_eq!(
            rows[0].bytes_on_disk,
            rows[0].total_bytes + manifest_len(&rig.root, "a")
        );
        assert!(app_kit_models_path(rig.store(), "a".into()).is_ok());

        // b is held mid-download, refused removal, then cancelled.
        app_kit_models_download(rig.store(), "b".into()).unwrap();
        let part = rig.root.join("b/w.bin.part");
        let start = Instant::now();
        while !part.exists() {
            assert!(start.elapsed() < Duration::from_secs(5), "no partial file");
            std::thread::sleep(Duration::from_millis(1));
        }
        let err = app_kit_models_remove(rig.store(), "b".into()).unwrap_err();
        assert!(err.contains("downloading"), "{err}");
        assert!(part.exists(), "the files stay");
        app_kit_models_cancel(rig.store(), "b".into());
        rig.wait("b", "notInstalled");
        assert!(!rig.root.join("b").exists());

        app_kit_models_remove(rig.store(), "a".into()).unwrap();
        rig.wait("a", "notInstalled");
        assert!(!rig.root.join("a").exists());
    }

    fn manifest_len(root: &Path, id: &str) -> u64 {
        fs::metadata(root.join(id).join("manifest.json"))
            .unwrap()
            .len()
    }

    #[test]
    fn a_fast_download_sends_few_events() {
        let rig = rig();
        let start = Instant::now();
        app_kit_models_download(rig.store(), "a".into()).unwrap();
        rig.wait("a", "ready");
        let elapsed = start.elapsed().as_secs_f64();
        let events = rig.events.lock().unwrap();
        let progress = events
            .iter()
            .filter(|(_, v)| v["status"]["kind"] == "downloading")
            .count();
        // The start notice, plus at most four a second.
        assert!(
            progress as f64 <= 1.0 + 4.0 * elapsed + 1.0,
            "{progress} progress events in {elapsed}s"
        );
        // A tagged object the TypeScript side can switch on.
        assert_eq!(events.last().unwrap().1["status"]["kind"], "ready");
        assert_eq!(events[0].1["status"]["total"], A.len());
    }

    #[test]
    fn remove_works_for_a_model_this_app_never_declared() {
        let rig = rig();
        let dir = rig.root.join("other");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("w.bin"), b"xyz").unwrap();
        fs::write(
            dir.join("manifest.json"),
            r#"{"id":"other","label":"Other","licence":"MIT","host":"h","files":[{"name":"w.bin","sha256":"00","size":3}]}"#,
        )
        .unwrap();
        let rows = app_kit_models_list(rig.store());
        let row = rows.iter().find(|r| r.id == "other").unwrap();
        assert_eq!(row.label, "Other");
        assert_eq!(row.status, ModelStatus::Ready);
        assert_eq!(row.total_bytes, 3);

        app_kit_models_remove(rig.store(), "other".into()).unwrap();
        assert!(!dir.exists());
        assert_eq!(rig.kinds("other"), ["notInstalled"]);
        // An id with no manifest never reaches the file system.
        assert!(app_kit_models_remove(rig.store(), "../x".into()).is_err());
    }

    #[test]
    fn wiring_declares_use() {
        let rig = rig();
        assert!(rig.root.join(".users/nz.preset.test.json").is_file());
    }
}
