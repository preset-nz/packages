//! The preference schema: what an app declares.
//!
//! Ids are the wire format. They are dotted, `section.key`, and the section
//! half is also the TOML table the value is stored under, so a hand-editor
//! sees `[library]` / `retention_days = 30`, not an opaque flat map.

use serde::{Deserialize, Serialize};

/// A preference value. The set is deliberately small: it is what a Settings
/// window can render and what a TOML file can hold without ceremony.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    List(Vec<String>),
}

impl From<bool> for Value {
    fn from(v: bool) -> Self {
        Value::Bool(v)
    }
}
impl From<i64> for Value {
    fn from(v: i64) -> Self {
        Value::Int(v)
    }
}
impl From<f64> for Value {
    fn from(v: f64) -> Self {
        Value::Float(v)
    }
}
impl From<&str> for Value {
    fn from(v: &str) -> Self {
        Value::Text(v.to_string())
    }
}
impl From<String> for Value {
    fn from(v: String) -> Self {
        Value::Text(v)
    }
}
impl From<Vec<String>> for Value {
    fn from(v: Vec<String>) -> Self {
        Value::List(v)
    }
}
impl From<&[&str]> for Value {
    fn from(v: &[&str]) -> Self {
        Value::List(v.iter().map(|s| s.to_string()).collect())
    }
}

/// How a preference is typed, bounded and rendered. The Settings window maps
/// each kind to a facets field; the store uses it to validate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Kind {
    Bool,
    Int {
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<i64>,
    },
    Float {
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<f64>,
    },
    Text,
    /// One of a fixed set. `options` are `(value, label)`.
    Select {
        options: Vec<Option_>,
    },
    /// A list of short strings, edited as chips or a comma list.
    List,
    /// A filesystem path shown but not edited. Apps use it for "where things
    /// live" until a move flow exists.
    ReadonlyPath,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Option_ {
    pub value: String,
    pub label: String,
}

/// A tab in the Settings window. Holds one or more sections. Pages are
/// presentation only: ids and the TOML file never mention them, so moving a
/// section to another page changes nothing on disk.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Page {
    pub id: String,
    pub label: String,
    /// One sentence on what the page holds. The generated docs lead with it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Section {
    pub id: String,
    pub label: String,
    /// The page it sits on. Required when the schema declares pages, absent
    /// when it does not.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
    /// Hidden behind the page's Advanced disclosure until someone opens it.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub advanced: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrefDef {
    /// `section.key`. The section must be declared in the schema.
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help: Option<String>,
    #[serde(flatten)]
    pub kind: Kind,
    pub default: Value,
}

/// Everything the app declares. `version` is the *file* version; bump it when
/// a stored value's meaning changes and handle the migration in `migrate`.
///
/// `pages` may be empty: the window then shows every section on one page,
/// with no tabs.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Schema {
    pub version: u32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pages: Vec<Page>,
    pub sections: Vec<Section>,
    pub prefs: Vec<PrefDef>,
}

impl Schema {
    pub fn def(&self, id: &str) -> Option<&PrefDef> {
        self.prefs.iter().find(|p| p.id == id)
    }

    /// The sections on `page`, in declared order. With no pages declared,
    /// every section is on the one implicit page, whatever id is asked for.
    pub fn sections_on<'a>(&'a self, page: &'a str) -> impl Iterator<Item = &'a Section> {
        let paged = !self.pages.is_empty();
        self.sections
            .iter()
            .filter(move |s| !paged || s.page.as_deref() == Some(page))
    }

    /// Check the declaration itself: every id is `section.key`, every section
    /// exists, ids are unique, defaults match their kind, and pages hold
    /// their sections. Called once by the store; a bad schema is a
    /// programming error, so this panics.
    pub fn assert_valid(&self) {
        self.assert_pages_valid();
        let mut seen = std::collections::HashSet::new();
        for p in &self.prefs {
            let (section, key) = split_id(&p.id)
                .unwrap_or_else(|| panic!("preference id `{}` is not `section.key`", p.id));
            assert!(
                !key.contains('.'),
                "preference id `{}` has more than one dot",
                p.id
            );
            assert!(
                self.sections.iter().any(|s| s.id == section),
                "preference `{}` names undeclared section `{section}`",
                p.id
            );
            assert!(
                seen.insert(&p.id),
                "preference id `{}` declared twice",
                p.id
            );
            assert!(
                p.kind.validate(&p.default).is_ok(),
                "preference `{}` has a default that fails its own kind",
                p.id
            );
        }
    }
}

impl Schema {
    fn assert_pages_valid(&self) {
        let mut pages = std::collections::HashSet::new();
        for p in &self.pages {
            assert!(pages.insert(&p.id), "page `{}` declared twice", p.id);
        }
        let mut sections = std::collections::HashSet::new();
        for s in &self.sections {
            assert!(sections.insert(&s.id), "section `{}` declared twice", s.id);
            match (&s.page, self.pages.is_empty()) {
                (Some(p), true) => {
                    panic!(
                        "section `{}` names page `{p}`, but no pages are declared",
                        s.id
                    )
                }
                (None, false) => panic!("section `{}` names no page", s.id),
                (Some(p), false) => assert!(
                    pages.contains(p),
                    "section `{}` names undeclared page `{p}`",
                    s.id
                ),
                (None, true) => {}
            }
        }
        for p in &self.pages {
            let mut on = self.sections_on(&p.id);
            assert!(
                on.any(|s| !s.advanced),
                "page `{}` has no section that is not advanced",
                p.id
            );
        }
        if self.pages.is_empty() && !self.sections.is_empty() {
            assert!(
                self.sections.iter().any(|s| !s.advanced),
                "every section is advanced"
            );
        }
    }
}

pub(crate) fn split_id(id: &str) -> Option<(&str, &str)> {
    id.split_once('.')
}

impl Kind {
    /// Coerce and bound a candidate value for this kind. Returns the value to
    /// store, or why it cannot be stored. Ints arriving as floats with no
    /// fraction are accepted, because JSON has one number type.
    pub fn validate(&self, v: &Value) -> Result<Value, String> {
        match (self, v) {
            (Kind::Bool, Value::Bool(b)) => Ok(Value::Bool(*b)),
            (Kind::Int { min, max }, Value::Int(i)) => bound_int(*i, *min, *max),
            (Kind::Int { min, max }, Value::Float(f)) if f.fract() == 0.0 => {
                bound_int(*f as i64, *min, *max)
            }
            (Kind::Float { min, max }, Value::Float(f)) => bound_float(*f, *min, *max),
            (Kind::Float { min, max }, Value::Int(i)) => bound_float(*i as f64, *min, *max),
            (Kind::Text, Value::Text(s)) => Ok(Value::Text(s.clone())),
            (Kind::ReadonlyPath, Value::Text(s)) => Ok(Value::Text(s.clone())),
            (Kind::Select { options }, Value::Text(s)) => {
                if options.iter().any(|o| &o.value == s) {
                    Ok(Value::Text(s.clone()))
                } else {
                    Err(format!("`{s}` is not one of the options"))
                }
            }
            (Kind::List, Value::List(l)) => Ok(Value::List(l.clone())),
            _ => Err(format!("wrong type for {}", self.name())),
        }
    }

    fn name(&self) -> &'static str {
        match self {
            Kind::Bool => "bool",
            Kind::Int { .. } => "int",
            Kind::Float { .. } => "float",
            Kind::Text => "text",
            Kind::Select { .. } => "select",
            Kind::List => "list",
            Kind::ReadonlyPath => "path",
        }
    }
}

fn bound_int(i: i64, min: Option<i64>, max: Option<i64>) -> Result<Value, String> {
    if let Some(lo) = min {
        if i < lo {
            return Err(format!("{i} is below the minimum {lo}"));
        }
    }
    if let Some(hi) = max {
        if i > hi {
            return Err(format!("{i} is above the maximum {hi}"));
        }
    }
    Ok(Value::Int(i))
}

fn bound_float(f: f64, min: Option<f64>, max: Option<f64>) -> Result<Value, String> {
    if !f.is_finite() {
        return Err("not a finite number".into());
    }
    if let Some(lo) = min {
        if f < lo {
            return Err(format!("{f} is below the minimum {lo}"));
        }
    }
    if let Some(hi) = max {
        if f > hi {
            return Err(format!("{f} is above the maximum {hi}"));
        }
    }
    Ok(Value::Float(f))
}

/// Builder for a `PrefDef`, so an app's declaration reads as a table.
pub fn pref(id: &str, label: &str, kind: Kind, default: impl Into<Value>) -> PrefDef {
    PrefDef {
        id: id.to_string(),
        label: label.to_string(),
        help: None,
        kind,
        default: default.into(),
    }
}

impl PrefDef {
    pub fn help(mut self, help: &str) -> Self {
        self.help = Some(help.to_string());
        self
    }
}

pub fn section(id: &str, label: &str) -> Section {
    Section {
        id: id.to_string(),
        label: label.to_string(),
        page: None,
        advanced: false,
    }
}

impl Section {
    /// Put the section on a declared page.
    pub fn page(mut self, page: &str) -> Self {
        self.page = Some(page.to_string());
        self
    }

    /// Hide the section behind its page's Advanced disclosure.
    pub fn advanced(mut self) -> Self {
        self.advanced = true;
        self
    }
}

pub fn page(id: &str, label: &str) -> Page {
    Page {
        id: id.to_string(),
        label: label.to_string(),
        summary: None,
    }
}

impl Page {
    pub fn summary(mut self, summary: &str) -> Self {
        self.summary = Some(summary.to_string());
        self
    }
}

pub fn options(pairs: &[(&str, &str)]) -> Vec<Option_> {
    pairs
        .iter()
        .map(|(v, l)| Option_ {
            value: v.to_string(),
            label: l.to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn int_kind_accepts_whole_floats_and_bounds() {
        let k = Kind::Int {
            min: Some(1),
            max: Some(10),
        };
        assert_eq!(k.validate(&Value::Float(3.0)), Ok(Value::Int(3)));
        assert!(k.validate(&Value::Float(3.5)).is_err());
        assert!(k.validate(&Value::Int(0)).is_err());
        assert!(k.validate(&Value::Int(11)).is_err());
        assert!(k.validate(&Value::Text("3".into())).is_err());
    }

    #[test]
    fn select_kind_rejects_unknown_option() {
        let k = Kind::Select {
            options: options(&[("system", "System"), ("dark", "Dark")]),
        };
        assert!(k.validate(&Value::Text("dark".into())).is_ok());
        assert!(k.validate(&Value::Text("sepia".into())).is_err());
    }

    #[test]
    #[should_panic(expected = "undeclared section")]
    fn schema_rejects_unknown_section() {
        Schema {
            version: 1,
            sections: vec![section("library", "Library")],
            prefs: vec![pref(
                "ingest.concurrency",
                "Concurrency",
                Kind::Int {
                    min: None,
                    max: None,
                },
                4,
            )],
            ..Schema::default()
        }
        .assert_valid();
    }

    fn paged(sections: Vec<Section>) -> Schema {
        Schema {
            version: 1,
            pages: vec![page("general", "General"), page("library", "Library")],
            sections,
            prefs: vec![],
        }
    }

    #[test]
    fn pages_hold_their_sections_in_order() {
        let s = paged(vec![
            section("appearance", "Appearance").page("general"),
            section("library", "Library").page("library"),
            section("cache", "Cache").page("library").advanced(),
        ]);
        s.assert_valid();
        let ids: Vec<_> = s.sections_on("library").map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["library", "cache"]);
    }

    #[test]
    fn without_pages_every_section_is_on_one_page() {
        let s = Schema {
            version: 1,
            sections: vec![section("a", "A"), section("b", "B").advanced()],
            ..Schema::default()
        };
        s.assert_valid();
        assert_eq!(s.sections_on("anything").count(), 2);
    }

    #[test]
    #[should_panic(expected = "names no page")]
    fn paged_schema_rejects_a_section_without_a_page() {
        paged(vec![
            section("appearance", "Appearance").page("general"),
            section("library", "Library"),
        ])
        .assert_valid();
    }

    #[test]
    #[should_panic(expected = "undeclared page")]
    fn paged_schema_rejects_an_unknown_page() {
        paged(vec![section("appearance", "Appearance").page("export")]).assert_valid();
    }

    #[test]
    #[should_panic(expected = "no pages are declared")]
    fn unpaged_schema_rejects_a_page_name() {
        Schema {
            version: 1,
            sections: vec![section("a", "A").page("general")],
            ..Schema::default()
        }
        .assert_valid();
    }

    #[test]
    #[should_panic(expected = "has no section that is not advanced")]
    fn a_page_needs_a_basic_section() {
        paged(vec![
            section("appearance", "Appearance").page("general"),
            section("cache", "Cache").page("library").advanced(),
        ])
        .assert_valid();
    }

    #[test]
    #[should_panic(expected = "section `a` declared twice")]
    fn schema_rejects_a_duplicate_section() {
        Schema {
            version: 1,
            sections: vec![section("a", "A"), section("a", "Again")],
            ..Schema::default()
        }
        .assert_valid();
    }

    #[test]
    fn a_schema_without_pages_serialises_as_before() {
        let s = Schema {
            version: 1,
            sections: vec![section("a", "A")],
            ..Schema::default()
        };
        let json = serde_json::to_value(&s).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"version": 1, "sections": [{"id": "a", "label": "A"}], "prefs": []})
        );
    }
}
