//! Models: a registry of downloadable model files and the store that gets them onto disk.
//!
//! An app declares [`ModelSpec`]s (id, files, URLs, SHA-256, sizes). A [`ModelStore`] downloads a
//! model on its own thread, reports progress, can cancel, verifies each file's checksum and removes
//! the folder. Pure Rust: no Tauri here. Design: `guidance/projects/app-kit/design/models.md`.
//!
//! Compiled only with the cargo feature `models`; that feature is what pulls in the HTTP client
//! and SHA-256.

mod download;
mod folder;
mod registry;
mod store;

pub use download::{DownloadError, Downloader, UreqDownloader};
pub use folder::default_root;
pub use registry::{FileSpec, ModelSpec};
pub use store::{InstalledModel, ModelError, ModelStatus, ModelStore};
