//! The playground's preferences: one setting, which app-kit's close guard reads.

use preset_preferences::{pref, section, Kind, Preferences, Schema};

/// "Ask to save changes when closing". On by default; off saves a document that has a file
/// on close and still asks for an Untitled one (ux-patterns.md, "Unsaved changes on close").
pub const ASK_TO_SAVE: &str = "documents.ask_to_save";

pub fn schema() -> Schema {
    Schema {
        version: 1,
        sections: vec![section("documents", "Documents")],
        prefs: vec![pref(
            ASK_TO_SAVE,
            "Ask to save changes when closing",
            Kind::Bool,
            true,
        )
        .help("Off: a document that has a file is saved when you close it. An Untitled one still asks.")],
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
