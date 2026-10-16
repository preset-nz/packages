//! Settings pages from a preset-preferences schema: one page per settings page, one table per
//! section, advanced sections last and marked, a preference's `help` as its row's sentence.
//!
//! The input is the JSON the schema serialises to, or a snapshot holding it under `schema`
//! (what `preferences_get` returns). The shapes are mirrored here rather than taken from the
//! crate, so preset-docs needs no preset-preferences release to read a new schema field.
//!
//! A schema without pages gives one page, `settings`, with no summary; `check` reports it.
//! Declare pages to document settings.

use std::collections::BTreeMap;

use serde::Deserialize;
use serde_json::Value as Json;

use crate::{Catalogue, Control, Kind, Node};

/// What a settings index calls its pages: "<app> settings".
pub const NOUN: &str = "settings";

/// The page an unpaged schema's sections all go on.
pub const IMPLICIT_PAGE: &str = "settings";

#[derive(Deserialize)]
struct Schema {
    #[serde(default)]
    pages: Vec<Page>,
    sections: Vec<Section>,
    prefs: Vec<Pref>,
}

#[derive(Deserialize)]
struct Page {
    id: String,
    label: String,
    #[serde(default)]
    summary: Option<String>,
}

#[derive(Deserialize)]
struct Section {
    id: String,
    label: String,
    #[serde(default)]
    page: Option<String>,
    #[serde(default)]
    advanced: bool,
}

#[derive(Deserialize)]
struct Pref {
    id: String,
    label: String,
    #[serde(default)]
    help: Option<String>,
    kind: String,
    #[serde(default)]
    min: Option<f64>,
    #[serde(default)]
    max: Option<f64>,
    #[serde(default)]
    options: Vec<Choice>,
    default: Json,
}

#[derive(Deserialize)]
struct Choice {
    value: String,
    label: String,
}

/// Reads a preferences schema, or a snapshot holding one under `schema`, as a catalogue.
pub fn read(json: &str) -> serde_json::Result<Catalogue> {
    let mut v: Json = serde_json::from_str(json)?;
    if let Some(inner) = v.get_mut("schema") {
        v = inner.take();
    }
    let schema: Schema = serde_json::from_value(v)?;
    catalogue(&schema).map_err(serde::de::Error::custom)
}

fn catalogue(schema: &Schema) -> Result<Catalogue, String> {
    let pages: Vec<Page> = if schema.pages.is_empty() {
        vec![Page {
            id: IMPLICIT_PAGE.into(),
            label: "Settings".into(),
            summary: None,
        }]
    } else {
        schema
            .pages
            .iter()
            .map(|p| Page {
                id: p.id.clone(),
                label: p.label.clone(),
                summary: p.summary.clone(),
            })
            .collect()
    };
    let paged = !schema.pages.is_empty();
    let mut types = Vec::with_capacity(pages.len());
    for page in pages {
        let on: Vec<&Section> = schema
            .sections
            .iter()
            .filter(|s| !paged || s.page.as_deref() == Some(page.id.as_str()))
            .collect();
        // basic sections first, then advanced, each in declared order: the window's order
        let ordered = on
            .iter()
            .filter(|s| !s.advanced)
            .chain(on.iter().filter(|s| s.advanced));
        let mut values = Vec::new();
        for section in ordered {
            let heading = if section.advanced {
                format!("{} (advanced)", section.label)
            } else {
                section.label.clone()
            };
            for pref in schema.prefs.iter().filter(|p| in_section(p, &section.id)) {
                values.push(control(pref, &heading)?);
            }
        }
        types.push(Node {
            name: page.id,
            label: Some(page.label),
            summary: page.summary,
            values,
            ..Node::default()
        });
    }
    Ok(Catalogue {
        types,
        noun: Some(NOUN.into()),
    })
}

fn in_section(pref: &Pref, section: &str) -> bool {
    pref.id.split_once('.').map(|(s, _)| s) == Some(section)
}

fn control(pref: &Pref, section: &str) -> Result<Control, String> {
    let kind = match pref.kind.as_str() {
        "bool" => Kind::Bool,
        "int" => Kind::Int,
        "float" => Kind::Float,
        "text" => Kind::Text,
        "select" => Kind::Choice,
        "list" => Kind::List,
        "readonly_path" => Kind::Path,
        other => return Err(format!("preference `{}`: unknown kind `{other}`", pref.id)),
    };
    let choice_labels: BTreeMap<String, String> = pref
        .options
        .iter()
        .filter(|o| o.label != o.value)
        .map(|o| (o.value.clone(), o.label.clone()))
        .collect();
    Ok(Control {
        key: pref.id.clone(),
        kind,
        default: pref.default.clone(),
        range: pref.min.zip(pref.max),
        soft_max: false,
        choices: pref.options.iter().map(|o| o.value.clone()).collect(),
        choice_labels,
        len: None,
        names: None,
        label: Some(pref.label.clone()),
        description: pref.help.clone(),
        unit: None,
        section: Some(section.to_string()),
    })
}
