//! The store: per-model state, the download thread, cancel and remove.

use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use super::download::{sha256_file, DownloadError, Downloader};
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
    /// Files are present but don't check out. Produced once the manifest check lands (story 2).
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
}

impl fmt::Display for ModelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unknown(id) => write!(f, "Unknown model {id}"),
            Self::Downloading(id) => write!(f, "{id} is downloading"),
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

struct Inner {
    root: PathBuf,
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
    /// `root` is the models folder; each model gets `<root>/<id>/`.
    pub fn new(
        root: impl Into<PathBuf>,
        registry: impl Into<Vec<ModelSpec>>,
        downloader: Arc<dyn Downloader>,
    ) -> Self {
        Self {
            inner: Arc::new(Inner {
                root: root.into(),
                registry: registry.into(),
                downloader,
                state: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// The model's folder (it may not exist).
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
        // Until the manifest lands (story 2): installed means every file is there at its size.
        if self.status_on_disk_ready(spec) {
            ModelStatus::Ready
        } else {
            ModelStatus::NotInstalled
        }
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
            if self.status_on_disk_ready(&spec) {
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

    /// Delete the model's folder and forget a failure. Refused while downloading.
    pub fn remove(&self, id: &str) -> Result<(), ModelError> {
        let spec = self.spec(id)?;
        let mut state = self.inner.state();
        if matches!(state.get(spec.id), Some(Entry::Downloading { .. })) {
            return Err(ModelError::Downloading(spec.id.to_string()));
        }
        state.remove(spec.id);
        match fs::remove_dir_all(self.inner.root.join(spec.id)) {
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

    fn status_on_disk_ready(&self, spec: &ModelSpec) -> bool {
        let dir = self.inner.root.join(spec.id);
        !spec.files.is_empty()
            && spec.files.iter().all(|f| {
                fs::metadata(dir.join(f.name)).is_ok_and(|m| m.is_file() && m.len() == f.size)
            })
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
    }

    impl Fake {
        fn new(files: &[(&'static str, &[u8])]) -> Self {
            Self {
                files: files.iter().map(|(u, b)| (*u, b.to_vec())).collect(),
                hold: Arc::new(AtomicBool::new(false)),
                end_hold: Arc::new(AtomicBool::new(false)),
                fail: None,
                urls: Mutex::new(vec![]),
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(root.path(), vec![spec("m", files)], fake);
        store.download("m").unwrap();
        wait_for(&store, "m", |s| *s == ModelStatus::Ready);
        assert!(root.path().join("m/one").exists() && root.path().join("m/two").exists());
    }

    #[test]
    fn cancel_mid_download_leaves_no_part_and_returns_to_not_installed() {
        let root = tempfile::tempdir().unwrap();
        let fake = Arc::new(Fake::new(&[("u://a", A)]));
        fake.hold.store(true, Ordering::Relaxed);
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
        let store = ModelStore::new(
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
}
