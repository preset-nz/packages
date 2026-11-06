//! A local-first agent for a desktop app: a model on the user's machine
//! (LM Studio, Ollama, llama.cpp) is shown the app's commands as tools, calls
//! them to edit the open document, and one undo takes the whole reply back.
//!
//! - [`client`]: one OpenAI-compatible streaming chat client, with sampling
//!   presets and a loop watch for models that go in circles.
//! - [`tools`]: a command shown to a model, and the [`tools::Toolbox`] seam an
//!   app implements over its own commands. The crate knows no app.
//! - [`run`]: the tool loop, with its limits (tokens, wall-clock, turns,
//!   cancel) always reported.
//! - [`log`]: every event of a run, kept so it can be written out and read
//!   later.
//!
//! No Tauri, no document model: the app owns both and hands the loop a
//! `Toolbox`.

pub mod client;
pub mod log;
pub mod run;
pub mod tools;
