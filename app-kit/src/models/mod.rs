//! Models: a registry of downloadable model files and the store that gets them onto disk.
//!
//! An app declares [`ModelSpec`]s (id, files, URLs, SHA-256, sizes). A [`ModelStore`] downloads a
//! model on its own thread, reports progress, can cancel, verifies each file's checksum and removes
//! the folder. The store is plain Rust; `commands` is the Tauri layer on top of it. Design: `guidance/projects/app-kit/design/models.md`.
//!
//! Compiled only with the cargo feature `models`; that feature is what pulls in the HTTP client
//! and SHA-256.

mod commands;
mod download;
mod folder;
mod registry;
mod store;

pub use commands::{
    app_kit_models_cancel, app_kit_models_download, app_kit_models_list, app_kit_models_path,
    app_kit_models_remove, install, install_with, ModelChange, MODELS_EVENT,
};
pub use download::{DownloadError, Downloader, HttpDownloader};
pub use folder::default_root;
pub use registry::{FileSpec, ModelSpec};
pub use store::{InstalledModel, ModelError, ModelInfo, ModelStatus, ModelStore};
