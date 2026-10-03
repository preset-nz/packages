//! A stand-in for the planned app-folders package (guidance `design/app-folders.md`): where the
//! playground's documents live by default, `~/preset-nz/Playground/Documents`. app-kit's Open
//! and Save panels start here for an Untitled document, through `AppKit::documents_folder`.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

/// The documents folder under a home directory. Fixed English names, so sibling apps find it.
pub fn documents_folder_in(home: &Path) -> PathBuf {
    home.join("preset-nz").join("Playground").join("Documents")
}

/// The documents folder, created if it is missing. `None` when there is no home directory or
/// the folder can't be made, which leaves the panel's start to macOS.
pub fn documents_folder<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let dir = documents_folder_in(&app.path().home_dir().ok()?);
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_live_under_the_family_root() {
        assert_eq!(
            documents_folder_in(Path::new("/Users/a")),
            PathBuf::from("/Users/a/preset-nz/Playground/Documents")
        );
    }
}
