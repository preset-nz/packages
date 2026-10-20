//! The store: per-model state, the download thread, cancel and remove, and the shared folder.

use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use super::download::{sha256_file, DownloadError, Downloader};
use super::folder::{self, Manifest, ManifestRead};
use super::registry::ModelSpec;

const CHECKSUM_FAILED: &str = "Checksum didn't match, file deleted";

/// Where a model stands. `Downloading` and `Failed` live in memory; the rest is read from disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ModelStatus {
    NotInstalled,
    Downloading {
        done: u64,
        total: u64,
    },
    Ready,
    /// The manifest is there but a file is missing, the wrong size, or the manifest is unreadable.
    Damaged,
    /// The last download ended in this one plain line. A restart forgets it.
    Failed {
        reason: String,
    },
}

/// Why a store call was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ModelError {
    /// No model with this id in the registry.
    Unknown(String),
    /// Refused: the model is downloading (cancel it first).
    Downloading(String),
    /// Couldn't start the thread or touch the folder.
    Io(String),
    /// No manifest: the model isn't installed.
    NotInstalled(String),
}

impl fmt::Display for ModelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unknown(id) => write!(f, "Unknown model {id}"),
            Self::Downloading(id) => write!(f, "{id} is downloading"),
            Self::NotInstalled(id) => write!(f, "Model {id} isn't installed"),
            Self::Io(msg) => f.write_str(msg),
        }
    }
}

impl std::error::Error for ModelError {}

enum Entry {
    Downloading {
        done: u64,
        total: u64,
        cancel: Arc<AtomicBool>,
    },
    Failed(String),
}

/// A model found in the shared folder, declared by this app or not, described by its manifest.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledModel {
    pub id: String,
    pub label: String,
    pub licence: String,
    pub host: String,
    /// Bytes the manifest lists.
    pub size: u64,
}

struct Inner {
    root: PathBuf,
    /// Set by `declare_use`; `used_by` leaves this app out.
    bundle_id: Mutex<Option<String>>,
    registry: Vec<ModelSpec>,
    downloader: Arc<dyn Downloader>,
    state: Mutex<HashMap<&'static str, Entry>>,
}

impl Inner {
    fn state(&self) -> MutexGuard<'_, HashMap<&'static str, Entry>> {
        // A panicking worker must not wedge every later call.
        self.state.lock().unwrap_or_else(|p| p.into_inner())
    }
}

/// Downloads, checks and removes the models of one registry under one root folder. Cheap to clone.
#[derive(Clone)]
pub struct ModelStore {
    inner: Arc<Inner>,
}

impl ModelStore {
    /// `root` is the models folder; each model gets `<root>/<id>/`. Tests pass a temp dir.
    pub fn with_root(
        root: impl Into<PathBuf>,
        registry: impl Into<Vec<ModelSpec>>,
        downloader: Arc<dyn Downloader>,
    ) -> Self {
        Self {
            inner: Arc::new(Inner {
                root: root.into(),
                bundle_id: Mutex::new(None),
                registry: registry.into(),
                downloader,
                state: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// The store on the machine-wide folder, `<data_dir>/rhizomatic/models/`, with `data_dir`
    /// from Tauri's path resolver.
    pub fn for_app<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        registry: impl Into<Vec<ModelSpec>>,
        downloader: Arc<dyn Downloader>,
    ) -> Result<Self, ModelError> {
        use tauri::Manager;
        let data = app
            .path()
            .data_dir()
            .map_err(|e| ModelError::Io(format!("Couldn't find the data folder: {e}")))?;
        Ok(Self::with_root(
            folder::default_root(&data),
            registry,
            downloader,
        ))
    }

    /// The model's folder (it may not exist). See [`path`](Self::path) for the checked one.
    pub fn model_dir(&self, id: &str) -> Result<PathBuf, ModelError> {
        Ok(self.inner.root.join(self.spec(id)?.id))
    }

    pub fn status(&self, id: &str) -> ModelStatus {
        let Ok(spec) = self.spec(id) else {
            return ModelStatus::NotInstalled;
        };
        match self.inner.state().get(spec.id) {
            Some(Entry::Downloading { done, total, .. }) => {
                return ModelStatus::Downloading {
                    done: *done,
                    total: *total,
                }
            }
            Some(Entry::Failed(reason)) => {
                return ModelStatus::Failed {
                    reason: reason.clone(),
                }
            }
            None => {}
        }
        self.status_on_disk(spec)
    }

    /// The model's folder, for a backend to read from. Checks that the manifest exists and
    /// nothing else; the error names the model.
    pub fn path(&self, id: &str) -> Result<PathBuf, ModelError> {
        let dir = self.model_dir(id)?;
        if dir.join(folder::MANIFEST).is_file() {
            Ok(dir)
        } else {
            Err(ModelError::NotInstalled(id.to_string()))
        }
    }

    /// Every model in the folder that has a manifest, including ones this app never declared.
    pub fn installed(&self) -> Vec<InstalledModel> {
        folder::installed_manifests(&self.inner.root)
            .into_iter()
            .map(|m| InstalledModel {
                size: m.total_size(),
                id: m.id,
                label: m.label,
                licence: m.licence,
                host: m.host,
            })
            .collect()
    }

    /// Rewrite this app's `.users/<bundle-id>.json` from its registry. Call at launch. It also
    /// tells `used_by` which file is this app's own.
    pub fn declare_use(&self, bundle_id: &str, app_name: &str) -> Result<(), ModelError> {
        if !folder::valid_bundle_id(bundle_id) {
            return Err(ModelError::Io(format!("Not a bundle id: {bundle_id}")));
        }
        let ids = self.inner.registry.iter().map(|m| m.id.to_string());
        folder::write_users(&self.inner.root, bundle_id, app_name, ids.collect())
            .map_err(|e| ModelError::Io(format!("Couldn't record which models are used: {e}")))?;
        *self
            .inner
            .bundle_id
            .lock()
            .unwrap_or_else(|p| p.into_inner()) = Some(bundle_id.to_string());
        Ok(())
    }

    /// Names of the other apps that declare this model. Best effort: a stale file from an
    /// uninstalled app adds a harmless extra name, and unreadable files are ignored.
    pub fn used_by(&self, id: &str) -> Vec<String> {
        let own = self
            .inner
            .bundle_id
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        folder::users_of(&self.inner.root, id, own.as_deref())
    }

    /// Start-up cleanup: delete `.part` files not modified for an hour, leaving younger ones
    /// (they may be another app's live download) and this app's own downloads alone. Returns how
    /// many were removed.
    pub fn clean_up(&self) -> usize {
        self.clean_up_older_than(folder::STALE_PART)
    }

    fn clean_up_older_than(&self, age: std::time::Duration) -> usize {
        let state = self.inner.state();
        let busy: Vec<&str> = state
            .iter()
            .filter(|(_, e)| matches!(e, Entry::Downloading { .. }))
            .map(|(id, _)| *id)
            .collect();
        folder::sweep_parts(&self.inner.root, age, &busy)
    }

    /// Re-hash every file against the manifest. `Ready` or `Damaged`; slow on a big model.
    /// Refused while downloading.
    pub fn verify(&self, id: &str) -> Result<ModelStatus, ModelError> {
        let spec = self.spec(id)?;
        if matches!(
            self.inner.state().get(spec.id),
            Some(Entry::Downloading { .. })
        ) {
            return Err(ModelError::Downloading(spec.id.to_string()));
        }
        let dir = self.inner.root.join(spec.id);
        let manifest = match folder::read_manifest(&dir) {
            ManifestRead::Missing => return Ok(ModelStatus::NotInstalled),
            ManifestRead::Malformed => return Ok(ModelStatus::Damaged),
            ManifestRead::Found(m) => m,
        };
        let intact = manifest.sizes_match(&dir)
            && manifest.files.iter().all(|f| {
                sha256_file(&dir.join(&f.name)).is_ok_and(|h| h.eq_ignore_ascii_case(&f.sha256))
            });
        Ok(if intact {
            ModelStatus::Ready
        } else {
            ModelStatus::Damaged
        })
    }

    /// Start downloading and return at once; a thread does the work. A model that is already
    /// `Ready` is left alone. Progress and the outcome show in [`status`](Self::status).
    pub fn download(&self, id: &str) -> Result<(), ModelError> {
        let spec = *self.spec(id)?;
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut state = self.inner.state();
            if matches!(state.get(spec.id), Some(Entry::Downloading { .. })) {
                return Err(ModelError::Downloading(spec.id.to_string()));
            }
            // Under the lock, so a second call can't slip in between the check and the insert.
            state.remove(spec.id);
            if self.status_on_disk(&spec) == ModelStatus::Ready {
                return Ok(());
            }
            state.insert(
                spec.id,
                Entry::Downloading {
                    done: 0,
                    total: spec.total_size(),
                    cancel: cancel.clone(),
                },
            );
        }
        let inner = self.inner.clone();
        let spawned = std::thread::Builder::new()
            .name(format!("model-download-{}", spec.id))
            .spawn(move || run(&inner, &spec, &cancel));
        if let Err(e) = spawned {
            self.inner.state().remove(spec.id);
            return Err(ModelError::Io(format!("Couldn't start the download: {e}")));
        }
        Ok(())
    }

    /// Ask a running download to stop. It deletes its partial files and the status returns to
    /// `NotInstalled`. Does nothing when the model isn't downloading.
    pub fn cancel(&self, id: &str) {
        if let Some(Entry::Downloading { cancel, .. }) = self.inner.state().get(id) {
            cancel.store(true, Ordering::Relaxed);
        }
    }

    /// Delete the model's manifest, then its folder, and forget a failure. The manifest goes
    /// first so an interrupted delete leaves the model "not installed". Refused while
    /// downloading.
    pub fn remove(&self, id: &str) -> Result<(), ModelError> {
        let spec = self.spec(id)?;
        let mut state = self.inner.state();
        if matches!(state.get(spec.id), Some(Entry::Downloading { .. })) {
            return Err(ModelError::Downloading(spec.id.to_string()));
        }
        state.remove(spec.id);
        let dir = self.inner.root.join(spec.id);
        match fs::remove_file(dir.join(folder::MANIFEST)) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(ModelError::Io(format!("Couldn't remove {}: {e}", spec.id))),
        }
        match fs::remove_dir_all(dir) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(ModelError::Io(format!("Couldn't remove {}: {e}", spec.id))),
        }
    }

    fn spec(&self, id: &str) -> Result<&ModelSpec, ModelError> {
        self.inner
            .registry
            .iter()
            .find(|m| m.id == id)
            .ok_or_else(|| ModelError::Unknown(id.to_string()))
    }

    /// From disk: no manifest is `NotInstalled`; a manifest whose files are all there at their
    /// sizes is `Ready`; anything else is `Damaged`.
    fn status_on_disk(&self, spec: &ModelSpec) -> ModelStatus {
        let dir = self.inner.root.join(spec.id);
        match folder::read_manifest(&dir) {
            ManifestRead::Missing => ModelStatus::NotInstalled,
            ManifestRead::Malformed => ModelStatus::Damaged,
            ManifestRead::Found(m) if m.sizes_match(&dir) => ModelStatus::Ready,
            ManifestRead::Found(_) => ModelStatus::Damaged,
        }
    }
}

enum Outcome {
    Done,
    Cancelled,
    Failed(String),
}

/// The download thread. Always ends by clearing or settling the model's entry.
fn run(inner: &Inner, spec: &ModelSpec, cancel: &AtomicBool) {
    let dir = inner.root.join(spec.id);
    let outcome = download_all(inner, spec, &dir, cancel);
    let mut state = inner.state();
    match outcome {
        Outcome::Done => {
            state.remove(spec.id);
        }
        Outcome::Cancelled => {
            let _ = fs::remove_dir_all(&dir);
            state.remove(spec.id);
        }
        Outcome::Failed(reason) => {
            let _ = fs::remove_dir_all(&dir);
            state.insert(spec.id, Entry::Failed(reason));
        }
    }
}

fn download_all(inner: &Inner, spec: &ModelSpec, dir: &Path, cancel: &AtomicBool) -> Outcome {
    if let Err(e) = fs::create_dir_all(dir) {
        return Outcome::Failed(DownloadError::from(e).to_string());
    }
    // Re-downloading a damaged model: until the new files pass, it isn't installed.
    let _ = fs::remove_file(dir.join(folder::MANIFEST));
    let mut finished = 0u64;
    for file in spec.files {
        if cancel.load(Ordering::Relaxed) {
            return Outcome::Cancelled;
        }
        let part = dir.join(format!("{}.part", file.name));
        let base = finished;
        let mut progress = |bytes: u64| {
            if let Some(Entry::Downloading { done, .. }) = inner.state().get_mut(spec.id) {
                *done = base + bytes;
            }
        };
        match inner
            .downloader
            .fetch(file.url, &part, &mut progress, cancel)
        {
            Ok(()) => {}
            Err(DownloadError::Cancelled) => return Outcome::Cancelled,
            Err(e) => return Outcome::Failed(e.to_string()),
        }
        if cancel.load(Ordering::Relaxed) {
            return Outcome::Cancelled;
        }
        match sha256_file(&part) {
            Ok(hash) if hash.eq_ignore_ascii_case(file.sha256) => {}
            Ok(_) => return Outcome::Failed(CHECKSUM_FAILED.to_string()),
            Err(e) => return Outcome::Failed(DownloadError::from(e).to_string()),
        }
        if let Err(e) = fs::rename(&part, dir.join(file.name)) {
            return Outcome::Failed(DownloadError::from(e).to_string());
        }
        finished += file.size;
        if let Some(Entry::Downloading { done, .. }) = inner.state().get_mut(spec.id) {
            *done = finished;
        }
    }
    if cancel.load(Ordering::Relaxed) {
        return Outcome::Cancelled;
    }
    // Last, once every file has passed its SHA-256: the manifest is what makes it installed.
    if let Err(e) = folder::write_manifest(dir, &Manifest::for_spec(spec)) {
        return Outcome::Failed(DownloadError::from(e).to_string());
    }
    Outcome::Done
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FileSpec;
    use sha2::{Digest, Sha256};
    use std::time::{Duration, Instant};

    fn hex(bytes: &[u8]) -> &'static str {
        let s: String = Sha256::digest(bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        Box::leak(s.into_boxed_str())
    }

    /// Writes known bytes in 10-byte steps; `hold` pauses it until released or cancelled.
    struct Fake {
        files: HashMap<&'static str, Vec<u8>>,
        hold: Arc<AtomicBool>,
        /// Pauses after the last byte is written and reported, before the fetch returns.
        end_hold: Arc<AtomicBool>,
        fail: Option<DownloadError>,
        urls: Mutex<Vec<String>>,
        /// Set when a manifest already existed as a fetch began.
        manifest_seen: AtomicBool,
    }

    impl Fake {
        fn new(files: &[(&'static str, &[u8])]) -> Self {
            Self {
                files: files.iter().map(|(u, b)| (*u, b.to_vec())).collect(),
                hold: Arc::new(AtomicBool::new(false)),
                end_hold: Arc::new(AtomicBool::new(false)),
                fail: None,
                urls: Mutex::new(vec![]),
                manifest_seen: AtomicBool::new(false),
            }
        }
    }

    impl Downloader for Fake {
        fn fetch(
            &self,
            url: &str,
            dest: &Path,
            progress: &mut dyn FnMut(u64),
            cancel: &AtomicBool,
        ) -> Result<(), DownloadError> {
            self.urls.lock().unwrap().push(url.to_string());
            if dest.with_file_name(folder::MANIFEST).exists() {
                self.manifest_seen.store(true, Ordering::Relaxed);
            }
            if let Some(e) = &self.fail {
                return Err(e.clone());
            }
            let bytes = &self.files[url];
            let mut out = Vec::new();
            for chunk in bytes.chunks(10) {
                while self.hold.load(Ordering::Relaxed) && !cancel.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(1));
                }
                if cancel.load(Ordering::Relaxed) {
                    fs::write(dest, &out).unwrap(); // leave a .part behind, as a real fetch would
                    return Err(DownloadError::Cancelled);
                }
                out.extend_from_slice(chunk);
                fs::write(dest, &out).unwrap();
                progress(out.len() as u64);
            }
            while self.end_hold.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(1));
            }
            Ok(())
        }
    }

    fn spec(id: &'static str, files: &'static [FileSpec]) -> ModelSpec {
        ModelSpec {
            id,
            label: id,
            used_by: "tests",
            licence: "MIT",
            host: "example.test",
            files,
        }
    }

    fn files_for(name: &'static str, url: &'static str, bytes: &[u8]) -> &'static [FileSpec] {
        Box::leak(Box::new([FileSpec {
            name,
            url,
            sha256: hex(bytes),
            size: bytes.len() as u64,
        }]))
    }

    fn wait_for(store: &ModelStore, id: &str, want: impl Fn(&ModelStatus) -> bool) -> ModelStatus {
        let start = Instant::now();
        loop {
            let s = store.status(id);
            if want(&s) {
                return s;
            }
            assert!(
                start.elapsed() < Duration::from_secs(5),
                "timed out in {s:?}"
            );
            std::thread::sleep(Duration::from_millis(2));
        }
    }

    fn no_parts(dir: &Path) -> bool {
        !dir.exists()
            || fs::read_dir(dir)
                .unwrap()
                .all(|e| !e.unwrap().file_name().to_string_lossy().ends_with(".part"))
    }

    const A: &[u8] = b"model bytes, a fair few of them for chunking";
    const B: &[u8] = b"a second model with different bytes entirely, longer than the first one";

    #[test]
    fn downloads_to_ready_with_progress_reaching_total() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake,
        );
        assert_eq!(store.status("a"), ModelStatus::NotInstalled);
        store.download("a").unwrap();
        let end = wait_for(&store, "a", |s| *s == ModelStatus::Ready);
        assert_eq!(end, ModelStatus::Ready);
        assert_eq!(fs::read(root.path().join("a/a.bin")).unwrap(), A);
        assert!(no_parts(&root.path().join("a")));
    }

    #[test]
    fn progress_is_visible_and_reaches_total() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        fake.hold.store(true, Ordering::Relaxed);
        fake.end_hold.store(true, Ordering::Relaxed);
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake.clone(),
        );
        store.download("a").unwrap();
        let total = A.len() as u64;
        assert_eq!(
            store.status("a"),
            ModelStatus::Downloading { done: 0, total }
        );
        fake.hold.store(false, Ordering::Relaxed);
        wait_for(&store, "a", |s| {
            *s == ModelStatus::Downloading { done: total, total }
        });
        fake.end_hold.store(false, Ordering::Relaxed);
        wait_for(&store, "a", |s| *s == ModelStatus::Ready);
    }

    #[test]
    fn multi_file_progress_accumulates_across_files() {
        let root = tempfile::tempdir().unwrap();
        let files: &'static [FileSpec] = Box::leak(Box::new([
            FileSpec {
                name: "one",
                url: "u://1",
                sha256: hex(A),
                size: A.len() as u64,
            },
            FileSpec {
                name: "two",
                url: "u://2",
                sha256: hex(B),
                size: B.len() as u64,
            },
        ]));
        let fake = Arc::new(Fake::new(&[("u://1", A), ("u://2", B)]));
        let store = ModelStore::with_root(root.path(), vec![spec("m", files)], fake);
        store.download("m").unwrap();
        wait_for(&store, "m", |s| *s == ModelStatus::Ready);
        assert!(root.path().join("m/one").exists() && root.path().join("m/two").exists());
    }

    #[test]
    fn cancel_mid_download_leaves_no_part_and_returns_to_not_installed() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        fake.hold.store(true, Ordering::Relaxed);
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake,
        );
        store.download("a").unwrap();
        store.cancel("a");
        wait_for(&store, "a", |s| *s == ModelStatus::NotInstalled);
        assert!(no_parts(&root.path().join("a")));
        assert!(!root.path().join("a/a.bin").exists());
    }

    #[test]
    fn wrong_checksum_fails_and_leaves_no_final_file() {
        let root = tempfile::tempdir().unwrap();
        // The registry expects A's hash but the server sends other bytes.
        let fake = Arc::new(Fake::new(&[("u://a", b"tampered bytes of the same sort")]));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake,
        );
        store.download("a").unwrap();
        let s = wait_for(&store, "a", |s| matches!(s, ModelStatus::Failed { .. }));
        assert_eq!(
            s,
            ModelStatus::Failed {
                reason: "Checksum didn't match, file deleted".into()
            }
        );
        assert!(!root.path().join("a/a.bin").exists());
        assert!(no_parts(&root.path().join("a")));
    }

    #[test]
    fn downloader_errors_become_one_plain_line() {
        let root = tempfile::tempdir().unwrap();
        let mut fake = Fake::new(&[]);
        fake.fail = Some(DownloadError::Status(404));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            Arc::new(fake),
        );
        store.download("a").unwrap();
        let s = wait_for(&store, "a", |s| matches!(s, ModelStatus::Failed { .. }));
        assert_eq!(
            s,
            ModelStatus::Failed {
                reason: "Server answered 404".into()
            }
        );
        // Retry is the user's: remove clears the failure and a new download may start.
        store.remove("a").unwrap();
        assert_eq!(store.status("a"), ModelStatus::NotInstalled);
    }

    #[test]
    fn remove_deletes_the_folder() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake,
        );
        store.download("a").unwrap();
        wait_for(&store, "a", |s| *s == ModelStatus::Ready);
        store.remove("a").unwrap();
        assert!(!root.path().join("a").exists());
        assert_eq!(store.status("a"), ModelStatus::NotInstalled);
    }

    #[test]
    fn remove_is_refused_while_downloading() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        fake.hold.store(true, Ordering::Relaxed);
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake.clone(),
        );
        store.download("a").unwrap();
        assert_eq!(store.remove("a"), Err(ModelError::Downloading("a".into())));
        assert_eq!(
            store.download("a"),
            Err(ModelError::Downloading("a".into()))
        );
        fake.hold.store(false, Ordering::Relaxed);
        wait_for(&store, "a", |s| *s == ModelStatus::Ready);
    }

    #[test]
    fn two_models_downloading_at_once_do_not_share_state() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A), ("u://b", B)]));
        fake.hold.store(true, Ordering::Relaxed);
        let store = ModelStore::with_root(
            root.path(),
            vec![
                spec("a", files_for("a.bin", "u://a", A)),
                spec("b", files_for("b.bin", "u://b", B)),
            ],
            fake.clone(),
        );
        store.download("a").unwrap();
        store.download("b").unwrap();
        assert_eq!(
            store.status("a"),
            ModelStatus::Downloading {
                done: 0,
                total: A.len() as u64
            }
        );
        assert_eq!(
            store.status("b"),
            ModelStatus::Downloading {
                done: 0,
                total: B.len() as u64
            }
        );
        // Cancelling one leaves the other running to completion.
        store.cancel("a");
        wait_for(&store, "a", |s| *s == ModelStatus::NotInstalled);
        assert!(matches!(store.status("b"), ModelStatus::Downloading { .. }));
        fake.hold.store(false, Ordering::Relaxed);
        wait_for(&store, "b", |s| *s == ModelStatus::Ready);
        assert_eq!(store.status("a"), ModelStatus::NotInstalled);
        assert!(!root.path().join("a/a.bin").exists());
        assert_eq!(fs::read(root.path().join("b/b.bin")).unwrap(), B);
    }

    #[test]
    fn a_ready_model_is_not_fetched_again_and_unknown_ids_are_refused() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("a", files_for("a.bin", "u://a", A))],
            fake.clone(),
        );
        store.download("a").unwrap();
        wait_for(&store, "a", |s| *s == ModelStatus::Ready);
        store.download("a").unwrap();
        assert_eq!(fake.urls.lock().unwrap().len(), 1);
        assert_eq!(
            store.download("zzz"),
            Err(ModelError::Unknown("zzz".into()))
        );
        assert_eq!(store.remove("zzz"), Err(ModelError::Unknown("zzz".into())));
    }

    fn two_files() -> &'static [FileSpec] {
        Box::leak(Box::new([
            FileSpec {
                name: "one",
                url: "u://1",
                sha256: hex(A),
                size: A.len() as u64,
            },
            FileSpec {
                name: "two",
                url: "u://2",
                sha256: hex(B),
                size: B.len() as u64,
            },
        ]))
    }

    fn ready_store(root: &Path, id: &'static str) -> (ModelStore, Arc<Fake>) {
        let fake = Arc::new(Fake::new(&[("u://1", A), ("u://2", B)]));
        let store = ModelStore::with_root(root, vec![spec(id, two_files())], fake.clone());
        store.download(id).unwrap();
        wait_for(&store, id, |s| *s == ModelStatus::Ready);
        (store, fake)
    }

    fn set_age(path: &Path, age: Duration) {
        let f = fs::OpenOptions::new().write(true).open(path).unwrap();
        f.set_modified(std::time::SystemTime::now() - age).unwrap();
    }

    #[test]
    fn manifest_is_written_last_and_files_without_one_are_not_installed() {
        let root = tempfile::tempdir().unwrap();
        // Files in place, no manifest: not installed.
        fs::create_dir_all(root.path().join("m")).unwrap();
        fs::write(root.path().join("m/one"), A).unwrap();
        fs::write(root.path().join("m/two"), B).unwrap();
        let fake = Arc::new(Fake::new(&[("u://1", A), ("u://2", B)]));
        let store = ModelStore::with_root(root.path(), vec![spec("m", two_files())], fake.clone());
        assert_eq!(store.status("m"), ModelStatus::NotInstalled);
        assert_eq!(store.path("m"), Err(ModelError::NotInstalled("m".into())));
        assert!(store.installed().is_empty());

        store.download("m").unwrap();
        wait_for(&store, "m", |s| *s == ModelStatus::Ready);
        // No manifest existed at any fetch, and it is complete and valid now.
        assert!(!fake.manifest_seen.load(Ordering::Relaxed));
        let m = match folder::read_manifest(&root.path().join("m")) {
            ManifestRead::Found(m) => m,
            _ => panic!("manifest should be valid"),
        };
        assert_eq!(m.id, "m");
        assert_eq!(m.files.len(), 2);
        assert_eq!(m.files[0].sha256, hex(A));
        assert_eq!(m.files[1].size, B.len() as u64);
        assert!(!root.path().join("m/manifest.json.part").exists());
        assert_eq!(store.path("m").unwrap(), root.path().join("m"));
    }

    #[test]
    fn truncating_a_file_makes_the_model_damaged_and_download_repairs_it() {
        let root = tempfile::tempdir().unwrap();
        let (store, fake) = ready_store(root.path(), "m");
        let f = fs::OpenOptions::new()
            .write(true)
            .open(root.path().join("m/two"))
            .unwrap();
        f.set_len(3).unwrap();
        assert_eq!(store.status("m"), ModelStatus::Damaged);
        // A missing file is damage too.
        fs::remove_file(root.path().join("m/one")).unwrap();
        assert_eq!(store.status("m"), ModelStatus::Damaged);
        // Retry downloads again; the stale manifest was not visible to the fetches.
        store.download("m").unwrap();
        wait_for(&store, "m", |s| *s == ModelStatus::Ready);
        assert!(!fake.manifest_seen.load(Ordering::Relaxed));
        assert_eq!(fs::read(root.path().join("m/two")).unwrap(), B);
    }

    #[test]
    fn a_malformed_manifest_is_damaged() {
        let root = tempfile::tempdir().unwrap();
        let (store, _) = ready_store(root.path(), "m");
        fs::write(root.path().join("m/manifest.json"), "{ nope").unwrap();
        assert_eq!(store.status("m"), ModelStatus::Damaged);
        assert!(store.installed().is_empty());
    }

    #[test]
    fn verify_rehashes_and_catches_a_same_size_change() {
        let root = tempfile::tempdir().unwrap();
        let (store, _) = ready_store(root.path(), "m");
        assert_eq!(store.verify("m"), Ok(ModelStatus::Ready));
        let mut bytes = fs::read(root.path().join("m/one")).unwrap();
        bytes[0] ^= 0xff;
        fs::write(root.path().join("m/one"), bytes).unwrap();
        // Same size, so the cheap status still says Ready; verify says Damaged.
        assert_eq!(store.status("m"), ModelStatus::Ready);
        assert_eq!(store.verify("m"), Ok(ModelStatus::Damaged));
    }

    #[test]
    fn installed_lists_models_this_app_never_declared() {
        let root = tempfile::tempdir().unwrap();
        // Another app's model, installed through its own store.
        let (_other, _) = ready_store(root.path(), "theirs");
        let mine = ModelStore::with_root(
            root.path(),
            vec![spec("mine", files_for("m.bin", "u://m", A))],
            Arc::new(Fake::new(&[])),
        );
        assert_eq!(mine.status("mine"), ModelStatus::NotInstalled);
        // A folder without a manifest, and the .users folder, are not models.
        fs::create_dir_all(root.path().join("half")).unwrap();
        fs::write(root.path().join("half/x"), b"x").unwrap();
        mine.declare_use("nz.preset.mine", "Mine").unwrap();
        let list = mine.installed();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "theirs");
        assert_eq!(list[0].label, "theirs");
        assert_eq!(list[0].licence, "MIT");
        assert_eq!(list[0].size, (A.len() + B.len()) as u64);
    }

    #[test]
    fn used_by_names_only_other_apps_and_ignores_malformed_files() {
        let root = tempfile::tempdir().unwrap();
        let reg = || vec![spec("m", files_for("m.bin", "u://m", A))];
        let oblique = ModelStore::with_root(root.path(), reg(), Arc::new(Fake::new(&[])));
        let strata = ModelStore::with_root(root.path(), reg(), Arc::new(Fake::new(&[])));
        let other = ModelStore::with_root(
            root.path(),
            vec![spec("unrelated", files_for("u.bin", "u://u", A))],
            Arc::new(Fake::new(&[])),
        );
        oblique.declare_use("nz.preset.oblique", "Oblique").unwrap();
        strata.declare_use("nz.preset.strata", "Strata").unwrap();
        other.declare_use("nz.preset.other", "Other").unwrap();
        fs::write(root.path().join(".users/broken.json"), "not json").unwrap();
        fs::write(root.path().join(".users/notes.txt"), "{}").unwrap();

        assert_eq!(oblique.used_by("m"), vec!["Strata".to_string()]);
        assert_eq!(strata.used_by("m"), vec!["Oblique".to_string()]);
        assert!(oblique.used_by("nothing").is_empty());
        // Rewriting at launch replaces the file rather than appending.
        oblique.declare_use("nz.preset.oblique", "Oblique").unwrap();
        assert_eq!(strata.used_by("m"), vec!["Oblique".to_string()]);
        assert!(oblique.declare_use("../evil", "X").is_err());
        assert!(!root.path().join("evil.json").exists());
    }

    #[test]
    fn clean_up_removes_stale_part_files_only() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("m");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("old.part"), b"x").unwrap();
        fs::write(dir.join("fresh.part"), b"x").unwrap();
        fs::write(dir.join("keep.bin"), b"x").unwrap();
        set_age(&dir.join("old.part"), Duration::from_secs(2 * 60 * 60));
        set_age(&dir.join("keep.bin"), Duration::from_secs(2 * 60 * 60));
        set_age(&dir.join("fresh.part"), Duration::from_secs(5 * 60));
        let store = ModelStore::with_root(
            root.path(),
            vec![spec("m", files_for("m.bin", "u://m", A))],
            Arc::new(Fake::new(&[])),
        );
        assert_eq!(store.clean_up(), 1);
        assert!(!dir.join("old.part").exists());
        assert!(dir.join("fresh.part").exists());
        assert!(dir.join("keep.bin").exists());
    }

    #[test]
    fn remove_deletes_the_manifest_first() {
        let root = tempfile::tempdir().unwrap();
        let (store, _) = ready_store(root.path(), "m");
        store.remove("m").unwrap();
        assert!(!root.path().join("m").exists());
        assert_eq!(store.status("m"), ModelStatus::NotInstalled);
        assert!(store.installed().is_empty());
    }

    #[test]
    fn default_root_is_under_rhizomatic() {
        assert_eq!(
            folder::default_root(Path::new("/data")),
            Path::new("/data/rhizomatic/models")
        );
    }
}
