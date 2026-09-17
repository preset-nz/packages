//! The store: schema plus current values plus the file they live in.
//!
//! Load never fails on content. A missing file means defaults; a value that
//! fails its kind is dropped to its default with a warning; an unknown key
//! is kept in memory and written back untouched, so an older app does not
//! erase what a newer one wrote. Save is atomic: write a sibling temp file,
//! then rename over the target.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::schema::{split_id, Schema, Value};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("unknown preference `{0}`")]
    UnknownId(String),
    #[error("`{id}`: {reason}")]
    Invalid { id: String, reason: String },
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("toml: {0}")]
    Toml(#[from] toml::ser::Error),
}

/// One warning raised while loading. Surfaced, never fatal.
#[derive(Debug, Clone, PartialEq)]
pub struct Warning {
    pub id: String,
    pub reason: String,
}

pub struct Store {
    schema: Schema,
    path: PathBuf,
    values: BTreeMap<String, Value>,
    /// Keys in the file that the schema does not know. Preserved on save.
    unknown: BTreeMap<String, BTreeMap<String, toml::Value>>,
    warnings: Vec<Warning>,
}

impl Store {
    /// Load from `path`, or start from defaults if the file is absent. A file
    /// that is not parseable at all is treated as absent and reported as one
    /// warning under the id `file`; the next save replaces it.
    pub fn load(schema: Schema, path: impl Into<PathBuf>) -> Self {
        schema.assert_valid();
        let path = path.into();
        let mut store = Store {
            values: schema.prefs.iter().map(|p| (p.id.clone(), p.default.clone())).collect(),
            schema,
            path,
            unknown: BTreeMap::new(),
            warnings: Vec::new(),
        };
        match std::fs::read_to_string(&store.path) {
            Ok(text) => store.absorb(&text),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => store.warn("file", e.to_string()),
        }
        store
    }

    fn absorb(&mut self, text: &str) {
        let doc: toml::Table = match text.parse() {
            Ok(t) => t,
            Err(e) => {
                self.warn("file", format!("not valid TOML, using defaults: {e}"));
                return;
            }
        };
        let file_version = doc.get("version").and_then(|v| v.as_integer()).unwrap_or(0) as u32;
        if file_version > self.schema.version {
            self.warn(
                "file",
                format!(
                    "file is version {file_version}, this app knows {}; unknown keys are kept",
                    self.schema.version
                ),
            );
        }
        for (section, table) in &doc {
            if section == "version" {
                continue;
            }
            let Some(table) = table.as_table() else {
                self.warn(section, "expected a table".into());
                continue;
            };
            for (key, raw) in table {
                let id = format!("{section}.{key}");
                match self.schema.def(&id) {
                    None => {
                        self.unknown
                            .entry(section.clone())
                            .or_default()
                            .insert(key.clone(), raw.clone());
                    }
                    Some(def) => match from_toml(raw).and_then(|v| def.kind.validate(&v)) {
                        Ok(v) => {
                            self.values.insert(id, v);
                        }
                        Err(reason) => {
                            self.warn(&id, format!("{reason}; using default"));
                        }
                    },
                }
            }
        }
    }

    fn warn(&mut self, id: &str, reason: String) {
        self.warnings.push(Warning {
            id: id.to_string(),
            reason,
        });
    }

    pub fn schema(&self) -> &Schema {
        &self.schema
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Warnings from the last load. Log them; do not block on them.
    pub fn warnings(&self) -> &[Warning] {
        &self.warnings
    }

    pub fn get(&self, id: &str) -> Option<&Value> {
        self.values.get(id)
    }

    pub fn get_bool(&self, id: &str) -> Option<bool> {
        match self.get(id)? {
            Value::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn get_int(&self, id: &str) -> Option<i64> {
        match self.get(id)? {
            Value::Int(i) => Some(*i),
            _ => None,
        }
    }

    pub fn get_float(&self, id: &str) -> Option<f64> {
        match self.get(id)? {
            Value::Float(f) => Some(*f),
            Value::Int(i) => Some(*i as f64),
            _ => None,
        }
    }

    pub fn get_text(&self, id: &str) -> Option<&str> {
        match self.get(id)? {
            Value::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn get_list(&self, id: &str) -> Option<&[String]> {
        match self.get(id)? {
            Value::List(l) => Some(l),
            _ => None,
        }
    }

    /// Every current value, keyed by id.
    pub fn values(&self) -> &BTreeMap<String, Value> {
        &self.values
    }

    pub fn is_default(&self, id: &str) -> bool {
        match (self.schema.def(id), self.values.get(id)) {
            (Some(def), Some(v)) => &def.default == v,
            _ => true,
        }
    }

    /// Validate, store and save. On error nothing changes on disk or in memory.
    pub fn set(&mut self, id: &str, value: Value) -> Result<(), Error> {
        let def = self
            .schema
            .def(id)
            .ok_or_else(|| Error::UnknownId(id.to_string()))?;
        let v = def.kind.validate(&value).map_err(|reason| Error::Invalid {
            id: id.to_string(),
            reason,
        })?;
        self.values.insert(id.to_string(), v);
        self.save()
    }

    /// Reset one section, or everything when `section` is `None`.
    pub fn reset(&mut self, section: Option<&str>) -> Result<(), Error> {
        for p in &self.schema.prefs {
            let in_scope = match section {
                None => true,
                Some(s) => split_id(&p.id).map(|(sec, _)| sec == s).unwrap_or(false),
            };
            if in_scope {
                self.values.insert(p.id.clone(), p.default.clone());
            }
        }
        self.save()
    }

    /// Write every value, grouped by section, plus preserved unknown keys.
    pub fn save(&self) -> Result<(), Error> {
        let mut doc = toml::Table::new();
        doc.insert("version".into(), toml::Value::Integer(self.schema.version as i64));
        for (id, v) in &self.values {
            let Some((section, key)) = split_id(id) else { continue };
            doc.entry(section)
                .or_insert_with(|| toml::Value::Table(toml::Table::new()))
                .as_table_mut()
                .expect("section is a table")
                .insert(key.to_string(), to_toml(v));
        }
        for (section, table) in &self.unknown {
            let target = doc
                .entry(section.as_str())
                .or_insert_with(|| toml::Value::Table(toml::Table::new()))
                .as_table_mut()
                .expect("section is a table");
            for (k, v) in table {
                target.entry(k.as_str()).or_insert_with(|| v.clone());
            }
        }
        let text = toml::to_string_pretty(&doc)?;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = self.path.with_extension("toml.tmp");
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, &self.path)?;
        Ok(())
    }
}

fn to_toml(v: &Value) -> toml::Value {
    match v {
        Value::Bool(b) => toml::Value::Boolean(*b),
        Value::Int(i) => toml::Value::Integer(*i),
        Value::Float(f) => toml::Value::Float(*f),
        Value::Text(s) => toml::Value::String(s.clone()),
        Value::List(l) => toml::Value::Array(l.iter().map(|s| toml::Value::String(s.clone())).collect()),
    }
}

fn from_toml(v: &toml::Value) -> Result<Value, String> {
    match v {
        toml::Value::Boolean(b) => Ok(Value::Bool(*b)),
        toml::Value::Integer(i) => Ok(Value::Int(*i)),
        toml::Value::Float(f) => Ok(Value::Float(*f)),
        toml::Value::String(s) => Ok(Value::Text(s.clone())),
        toml::Value::Array(a) => a
            .iter()
            .map(|x| match x {
                toml::Value::String(s) => Ok(s.clone()),
                other => Err(format!("list item `{other}` is not a string")),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::List),
        other => Err(format!("unsupported TOML value `{other}`")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{options, pref, section, Kind};

    fn schema() -> Schema {
        Schema {
            version: 1,
            sections: vec![section("library", "Library"), section("appearance", "Appearance")],
            prefs: vec![
                pref(
                    "library.retention_days",
                    "Retention",
                    Kind::Int { min: Some(1), max: Some(365) },
                    30,
                ),
                pref(
                    "appearance.theme",
                    "Theme",
                    Kind::Select { options: options(&[("system", "System"), ("dark", "Dark")]) },
                    "system",
                ),
                pref("library.extensions", "Extensions", Kind::List, &["jpg", "png"][..]),
            ],
        }
    }

    fn tmp() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("preferences.toml");
        (dir, path)
    }

    #[test]
    fn missing_file_yields_defaults_and_no_warnings() {
        let (_d, path) = tmp();
        let s = Store::load(schema(), &path);
        assert_eq!(s.get_int("library.retention_days"), Some(30));
        assert!(s.warnings().is_empty());
        assert!(!path.exists());
    }

    #[test]
    fn set_round_trips_through_the_file() {
        let (_d, path) = tmp();
        let mut s = Store::load(schema(), &path);
        s.set("library.retention_days", Value::Int(7)).unwrap();
        s.set("appearance.theme", "dark".into()).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("version = 1"), "{text}");
        assert!(text.contains("[library]"), "{text}");
        assert!(text.contains("retention_days = 7"), "{text}");
        let again = Store::load(schema(), &path);
        assert_eq!(again.get_int("library.retention_days"), Some(7));
        assert_eq!(again.get_text("appearance.theme"), Some("dark"));
        assert_eq!(again.get_list("library.extensions").unwrap(), &["jpg", "png"]);
        assert!(!again.is_default("library.retention_days"));
    }

    #[test]
    fn set_rejects_out_of_range_and_unknown() {
        let (_d, path) = tmp();
        let mut s = Store::load(schema(), &path);
        assert!(matches!(
            s.set("library.retention_days", Value::Int(-5)),
            Err(Error::Invalid { .. })
        ));
        assert!(matches!(s.set("nope.x", Value::Int(1)), Err(Error::UnknownId(_))));
        assert_eq!(s.get_int("library.retention_days"), Some(30));
    }

    #[test]
    fn hand_edited_nonsense_falls_back_with_a_warning() {
        let (_d, path) = tmp();
        std::fs::write(
            &path,
            "version = 1\n[library]\nretention_days = -5\n[appearance]\ntheme = \"sepia\"\n",
        )
        .unwrap();
        let s = Store::load(schema(), &path);
        assert_eq!(s.get_int("library.retention_days"), Some(30));
        assert_eq!(s.get_text("appearance.theme"), Some("system"));
        assert_eq!(s.warnings().len(), 2);
    }

    #[test]
    fn unparseable_file_is_one_warning_and_defaults() {
        let (_d, path) = tmp();
        std::fs::write(&path, "this is = = not toml").unwrap();
        let s = Store::load(schema(), &path);
        assert_eq!(s.get_int("library.retention_days"), Some(30));
        assert_eq!(s.warnings().len(), 1);
        assert_eq!(s.warnings()[0].id, "file");
    }

    #[test]
    fn unknown_keys_survive_a_save() {
        let (_d, path) = tmp();
        std::fs::write(&path, "version = 1\n[library]\nfuture_knob = true\n[other]\nx = 1\n").unwrap();
        let mut s = Store::load(schema(), &path);
        s.set("library.retention_days", Value::Int(9)).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("future_knob = true"), "{text}");
        assert!(text.contains("[other]"), "{text}");
    }

    #[test]
    fn reset_by_section_and_all() {
        let (_d, path) = tmp();
        let mut s = Store::load(schema(), &path);
        s.set("library.retention_days", Value::Int(7)).unwrap();
        s.set("appearance.theme", "dark".into()).unwrap();
        s.reset(Some("library")).unwrap();
        assert_eq!(s.get_int("library.retention_days"), Some(30));
        assert_eq!(s.get_text("appearance.theme"), Some("dark"));
        s.reset(None).unwrap();
        assert_eq!(s.get_text("appearance.theme"), Some("system"));
    }
}
