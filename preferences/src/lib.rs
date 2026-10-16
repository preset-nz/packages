//! preset-preferences: typed, versioned TOML preferences for the preset.nz
//! desktop apps.
//!
//! An app declares a [`Schema`] (sections, preference ids, kinds, defaults),
//! opens a [`Preferences`] handle on a file in its config directory, and
//! reads values from anywhere in the backend. With the `tauri` feature the
//! same handle is Tauri state, and three commands plus one event let the
//! frontend read, write and follow changes.
//!
//! ```no_run
//! use preset_preferences::{Kind, Preferences, Schema, pref, section};
//!
//! let schema = Schema {
//!     version: 1,
//!     sections: vec![section("library", "Library")],
//!     prefs: vec![pref(
//!         "library.retention_days",
//!         "Keep deleted images for",
//!         Kind::Int { min: Some(1), max: Some(365) },
//!         30,
//!     )],
//! };
//! let prefs = Preferences::open(schema, "/tmp/preferences.toml");
//! assert_eq!(prefs.get_int("library.retention_days"), Some(30));
//! ```

pub mod schema;
pub mod store;
#[cfg(feature = "tauri")]
pub mod tauri;

use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

pub use schema::{options, pref, section, Kind, Option_, PrefDef, Schema, Section, Value};
pub use store::{Error, Store, Warning};

/// A shared, thread-safe handle on one store. Clone it freely; every clone
/// sees the same values. The typed getters lock briefly and copy out, so a
/// backend can call them from any thread without holding anything.
#[derive(Clone)]
pub struct Preferences(Arc<Mutex<Store>>);

impl Preferences {
    /// Load the file (or defaults) and log any warnings to stderr.
    pub fn open(schema: Schema, path: impl Into<PathBuf>) -> Self {
        let store = Store::load(schema, path);
        for w in store.warnings() {
            eprintln!("preferences: {}: {}", w.id, w.reason);
        }
        Self(Arc::new(Mutex::new(store)))
    }

    /// Direct access for anything the getters do not cover. Keep the guard
    /// short; a command is waiting behind it.
    pub fn lock(&self) -> MutexGuard<'_, Store> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn get(&self, id: &str) -> Option<Value> {
        self.lock().get(id).cloned()
    }
    pub fn get_bool(&self, id: &str) -> Option<bool> {
        self.lock().get_bool(id)
    }
    pub fn get_int(&self, id: &str) -> Option<i64> {
        self.lock().get_int(id)
    }
    pub fn get_float(&self, id: &str) -> Option<f64> {
        self.lock().get_float(id)
    }
    pub fn get_text(&self, id: &str) -> Option<String> {
        self.lock().get_text(id).map(str::to_string)
    }
    pub fn get_list(&self, id: &str) -> Option<Vec<String>> {
        self.lock().get_list(id).map(<[String]>::to_vec)
    }

    pub fn set(&self, id: &str, value: impl Into<Value>) -> Result<(), Error> {
        self.lock().set(id, value.into())
    }

    pub fn reset(&self, section: Option<&str>) -> Result<(), Error> {
        self.lock().reset(section)
    }

    /// What the frontend needs to render and edit: the schema, every current
    /// value, and where the file is.
    pub fn snapshot(&self) -> Snapshot {
        let s = self.lock();
        Snapshot {
            schema: s.schema().clone(),
            values: s.values().clone(),
            path: s.path().to_string_lossy().into_owned(),
        }
    }
}

/// Serialised for the frontend by `preferences_get` and carried by the
/// `preferences://changed` event. Defaults ride along inside the schema, so
/// "is this changed?" is answered without another round trip.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Snapshot {
    pub schema: Schema,
    pub values: std::collections::BTreeMap<String, Value>,
    pub path: String,
}
