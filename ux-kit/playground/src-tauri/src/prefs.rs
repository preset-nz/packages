//! The playground's preferences. The close guard reads `documents.ask_to_save`; the
//! rest is there so the Settings window (Cmd+,) shows two pages and an Advanced row
//! on each, as facets draws them. Nothing reads those.

use preset_preferences::{page, pref, section, Kind, Preferences, Schema};

/// "Ask to save changes when closing". On by default; off saves a document that has a file
/// on close and still asks for an Untitled one (ux-patterns.md, "Unsaved changes on close").
pub const ASK_TO_SAVE: &str = "documents.ask_to_save";

pub fn schema() -> Schema {
    Schema {
        version: 1,
        pages: vec![page("general", "General"), page("export", "Export")],
        sections: vec![
            section("documents", "Documents").page("general"),
            section("recent", "Recent documents").page("general").advanced(),
            section("export", "Export").page("export"),
            section("metadata", "Metadata").page("export").advanced(),
        ],
        prefs: vec![
            pref(
                ASK_TO_SAVE,
                "Ask to save changes when closing",
                Kind::Bool,
                true,
            )
            .help("Off: a document that has a file is saved when you close it. An Untitled one still asks."),
            pref(
                "recent.limit",
                "Documents in Open Recent",
                Kind::Int { min: Some(0), max: Some(30) },
                10,
            ),
            pref(
                "export.scale",
                "Scale",
                Kind::Int { min: Some(1), max: Some(4) },
                1,
            ),
            pref("export.reveal", "Show the file when done", Kind::Bool, false),
            pref("metadata.strip", "Leave out metadata", Kind::Bool, true)
                .help("Writes no software name or timestamps into the exported file."),
        ],
    }
}

/// The setting as the close guard reads it; on when the preferences are not there.
pub fn ask_to_save(prefs: Option<&Preferences>) -> bool {
    prefs.and_then(|p| p.get_bool(ASK_TO_SAVE)).unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_setting_defaults_to_on() {
        let dir = std::env::temp_dir().join(format!("playground-prefs-{}", std::process::id()));
        let prefs = Preferences::open(schema(), dir.join("preferences.toml"));
        assert!(ask_to_save(Some(&prefs)));
        assert!(ask_to_save(None));
        prefs.set(ASK_TO_SAVE, false).unwrap();
        assert!(!ask_to_save(Some(&prefs)));
        let _ = std::fs::remove_dir_all(dir);
    }
}
