//! The shared models folder on disk: where it is, the manifest in each model's folder, the
//! `.users` files that say which app uses what, and the sweep of stale `.part` files.
//!
//! Layout and rules: `guidance/projects/app-kit/design/models.md#the-folder`. Nothing here
//! locks or coordinates: every write is a write-to-temp-and-rename, so another app sees the old
//! file or the new one, never half of one.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};

use super::registry::ModelSpec;

/// The marker that a model is installed. Written last.
pub(crate) const MANIFEST: &str = "manifest.json";
/// Folder under the root holding one file per app.
pub(crate) const USERS_DIR: &str = ".users";
/// Partial files not touched for this long are swept at start-up.
pub(crate) const STALE_PART: Duration = Duration::from_secs(60 * 60);

/// `<data_dir>/rhizomatic/models`, shared by every app on the machine.
pub fn default_root(data_dir: &Path) -> PathBuf {
    data_dir.join("rhizomatic").join("models")
}

/// What `manifest.json` holds: enough for any app to list a model it never declared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Manifest {
    pub id: String,
    pub label: String,
    pub licence: String,
    pub host: String,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ManifestFile {
    pub name: String,
    pub sha256: String,
    pub size: u64,
}

impl Manifest {
    pub fn for_spec(spec: &ModelSpec) -> Self {
        Self {
            id: spec.id.to_string(),
            label: spec.label.to_string(),
            licence: spec.licence.to_string(),
            host: spec.host.to_string(),
            files: spec
                .files
                .iter()
                .map(|f| ManifestFile {
                    name: f.name.to_string(),
                    sha256: f.sha256.to_string(),
                    size: f.size,
                })
                .collect(),
        }
    }

    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }

    /// Every file is present and its size is the manifest's. Not a hash: that is `verify`.
    pub fn sizes_match(&self, dir: &Path) -> bool {
        self.files.iter().all(|f| {
            fs::metadata(dir.join(&f.name)).is_ok_and(|m| m.is_file() && m.len() == f.size)
        })
    }
}

/// The manifest of a model folder.
pub(crate) enum ManifestRead {
    /// No `manifest.json`: not installed.
    Missing,
    /// Present but unreadable or not valid.
    Malformed,
    Found(Manifest),
}

pub(crate) fn read_manifest(dir: &Path) -> ManifestRead {
    match fs::read(dir.join(MANIFEST)) {
        Ok(bytes) => match serde_json::from_slice(&bytes) {
            Ok(m) => ManifestRead::Found(m),
            Err(_) => ManifestRead::Malformed,
        },
        Err(e) if e.kind() == io::ErrorKind::NotFound => ManifestRead::Missing,
        Err(_) => ManifestRead::Malformed,
    }
}

/// Write `manifest.json` by writing `manifest.json.part` and renaming it into place.
pub(crate) fn write_manifest(dir: &Path, manifest: &Manifest) -> io::Result<()> {
    write_atomic(&dir.join(MANIFEST), &to_json(manifest)?)
}

fn to_json<T: Serialize>(value: &T) -> io::Result<Vec<u8>> {
    serde_json::to_vec_pretty(value).map_err(io::Error::other)
}

fn write_atomic(dest: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut tmp = dest.as_os_str().to_owned();
    tmp.push(".part");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, dest).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// `.users/<bundle-id>.json`.
#[derive(Debug, Serialize, Deserialize)]
struct UsersFile {
    name: String,
    models: Vec<String>,
}

/// A bundle id becomes a file name, so it can't carry a path.
pub(crate) fn valid_bundle_id(id: &str) -> bool {
    !id.is_empty() && !id.starts_with('.') && !id.contains(['/', '\\', '\0'])
}

pub(crate) fn write_users(
    root: &Path,
    bundle_id: &str,
    app_name: &str,
    models: Vec<String>,
) -> io::Result<()> {
    let dir = root.join(USERS_DIR);
    fs::create_dir_all(&dir)?;
    let file = UsersFile {
        name: app_name.to_string(),
        models,
    };
    write_atomic(&dir.join(format!("{bundle_id}.json")), &to_json(&file)?)
}

/// Names of the apps other than `own_bundle_id` whose file lists `model_id`. Unreadable or
/// malformed files are skipped. Sorted and without repeats.
pub(crate) fn users_of(root: &Path, model_id: &str, own_bundle_id: Option<&str>) -> Vec<String> {
    let Ok(entries) = fs::read_dir(root.join(USERS_DIR)) else {
        return vec![];
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter_map(|e| {
            let path = e.path();
            if path.extension()? != "json" {
                return None;
            }
            if own_bundle_id.is_some_and(|own| path.file_stem().is_some_and(|s| s == own)) {
                return None;
            }
            let file: UsersFile = serde_json::from_slice(&fs::read(&path).ok()?).ok()?;
            file.models
                .iter()
                .any(|m| m == model_id)
                .then_some(file.name)
        })
        .collect();
    names.sort();
    names.dedup();
    names
}

/// Bytes held by the files directly inside `dir` (0 when it doesn't exist).
pub(crate) fn bytes_in(dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };
    entries
        .filter_map(Result::ok)
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

/// Every model folder under `root` with a valid manifest, sorted by id. Dot-folders
/// (`.users`) and folders whose manifest names a different id are skipped.
pub(crate) fn installed_manifests(root: &Path) -> Vec<Manifest> {
    let Ok(entries) = fs::read_dir(root) else {
        return vec![];
    };
    let mut found: Vec<Manifest> = entries
        .filter_map(Result::ok)
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            match read_manifest(&e.path()) {
                ManifestRead::Found(m) if m.id == name => Some(m),
                _ => None,
            }
        })
        .collect();
    found.sort_by(|a, b| a.id.cmp(&b.id));
    found
}

/// Delete `*.part` files in model folders and `.users` that were last modified more than `age`
/// ago. A younger one may belong to another app's live download. Skips the folders in `skip`
/// (this app's own downloads). Returns how many were removed.
pub(crate) fn sweep_parts(root: &Path, age: Duration, skip: &[&str]) -> usize {
    let Ok(entries) = fs::read_dir(root) else {
        return 0;
    };
    let now = SystemTime::now();
    let mut removed = 0;
    for dir in entries.filter_map(Result::ok).filter(|e| e.path().is_dir()) {
        if skip.iter().any(|s| dir.file_name() == *s) {
            continue;
        }
        let Ok(files) = fs::read_dir(dir.path()) else {
            continue;
        };
        for f in files.filter_map(Result::ok) {
            let path = f.path();
            if path.extension().is_none_or(|e| e != "part") {
                continue;
            }
            let stale = f
                .metadata()
                .and_then(|m| m.modified())
                .is_ok_and(|t| now.duration_since(t).is_ok_and(|d| d > age));
            if stale && fs::remove_file(&path).is_ok() {
                removed += 1;
            }
        }
    }
    removed
}
