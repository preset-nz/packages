//! Settings pages from a preset-preferences schema (`fixtures/preferences.json`, dumped from
//! the crate itself): one page per settings page, a table per section, advanced last.

use std::fs;
use std::path::PathBuf;

use preset_docs::{Finding, INDEX, check, pages, preferences, write};

const FIXTURE: &str = include_str!("fixtures/preferences.json");

fn golden(name: &str, actual: &str) {
    let file = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/golden/preferences")
        .join(name);
    if std::env::var_os("PRESET_DOCS_BLESS").is_some() {
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, actual).unwrap();
        return;
    }
    let expected = fs::read_to_string(&file)
        .unwrap_or_else(|_| panic!("no golden {name}; run `just bless` and read it"));
    assert_eq!(expected, actual, "{name} differs from its golden");
}

#[test]
fn a_page_per_settings_page_and_the_index() {
    let catalogue = preferences::read(FIXTURE).unwrap();
    let pages = pages(&catalogue, "Example");
    let names: Vec<_> = pages.iter().map(|p| p.file_name.as_str()).collect();
    assert_eq!(names, ["general.md", "library.md", INDEX]);
    for p in &pages {
        golden(&p.file_name, &p.content);
    }
}

#[test]
fn advanced_sections_come_last_and_marked() {
    let catalogue = preferences::read(FIXTURE).unwrap();
    let library = &pages(&catalogue, "Example")[1].content;
    let at = |h: &str| library.find(h).unwrap_or_else(|| panic!("no {h}"));
    assert!(at("### Library") < at("### Trash"));
    assert!(at("### Trash") < at("### Cache (advanced)"));
}

#[test]
fn a_path_never_prints_the_machine_it_was_dumped_on() {
    let catalogue = preferences::read(FIXTURE).unwrap();
    let library = &pages(&catalogue, "Example")[1].content;
    assert!(!library.contains("/Users/someone"));
    assert!(library.contains("| Library folder | a path, shown only | set by the app |"));
}

#[test]
fn a_snapshot_reads_as_its_schema() {
    let snapshot = format!(r#"{{"schema": {FIXTURE}, "values": {{}}, "path": "/x"}}"#);
    assert_eq!(
        preferences::read(&snapshot).unwrap(),
        preferences::read(FIXTURE).unwrap()
    );
}

#[test]
fn an_unpaged_schema_is_one_page_without_a_summary() {
    let json = r#"{"version": 1, "sections": [{"id": "a", "label": "A"}],
        "prefs": [{"id": "a.on", "label": "On", "kind": "bool", "default": true}]}"#;
    let catalogue = preferences::read(json).unwrap();
    assert_eq!(catalogue.types.len(), 1);
    assert_eq!(catalogue.types[0].name, preferences::IMPLICIT_PAGE);
    let dir = std::env::temp_dir().join(format!("preset-docs-{}-unpaged", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    write(&dir, &catalogue, "Example").unwrap();
    let found = check(&dir, &catalogue, "Example").unwrap();
    assert!(found.contains(&Finding::MissingSummary {
        node: "settings".into()
    }));
}

#[test]
fn an_unknown_kind_is_an_error() {
    let json = r##"{"version": 1, "sections": [{"id": "a", "label": "A"}],
        "prefs": [{"id": "a.x", "label": "X", "kind": "colour", "default": "#fff"}]}"##;
    let err = preferences::read(json).unwrap_err().to_string();
    assert!(err.contains("unknown kind `colour`"), "{err}");
}
