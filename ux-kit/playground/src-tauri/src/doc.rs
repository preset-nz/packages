//! An in-memory rhizome tree with a few sample nodes, and one command to list them.
//!
//! Uses rhizome-core as it is: `Registry`, `Tree`, `Edit::add`, `Tree::rows`. The node
//! type and category below are made up for the playground, not an app's object model.
//! Edits are labelled `Tree::edit` calls; undo and redo are `Tree::undo` / `Tree::redo`.
//! Every change emits `rhizome://commit` (the `Commit`) and refreshes the Edit menu.
//! TODO: move to rhizome-pom / rhizome-pom-tauri (open document, commit events,
//! undo wired to the Edit menu) once that exists; this is the hand-rolled version.

use std::sync::Mutex;

use rhizome_core::{Commit, NodeId, NodeType, Origin, Registry, Row, Tree, Value};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::menu;

/// `Tree` is `Send` but not `Sync`, so the one open tree sits behind a mutex.
pub struct Doc(pub(crate) Mutex<Tree>);

impl Doc {
    pub fn sample() -> Doc {
        let registry = Registry::builder()
            .category("notes", Origin::Loaded)
            .node(
                NodeType::new("note")
                    .in_categories(&["notes"])
                    .text("body", "")
                    .colour("colour", [0.97, 0.96, 0.91, 1.0]),
            )
            .build()
            .expect("sample registry");

        let mut tree = Tree::new(registry);
        tree.edit("Add sample notes", |tx| {
            let welcome = tx.add("/notes", "note", "welcome")?;
            tx.set_value(welcome, "body", Value::Text("Hello from rhizome".into()))?;
            tx.add(welcome, "note", "reply")?;
            tx.add("/notes", "note", "todo")?;
            tx.add("/notes", "note", "ideas")?;
            Ok(())
        })
        .expect("sample nodes");

        Doc(Mutex::new(tree))
    }
}

/// Every node as a rhizome `Row`, in path order.
#[tauri::command]
pub fn rhizome_rows(doc: State<'_, Doc>) -> Vec<Row> {
    doc.0.lock().expect("tree lock").rows()
}

/// The tree's history as it stands: `Tree::undo_label`, `Tree::redo_label`,
/// `Tree::history_len`, and every step from `Tree::undo_labels` / `Tree::redo_labels`.
#[derive(Clone, Debug, Default, Serialize)]
pub struct HistoryState {
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
    pub history_len: usize,
    /// Oldest first.
    pub undo_labels: Vec<String>,
    /// Next first.
    pub redo_labels: Vec<String>,
}

impl HistoryState {
    pub fn of(tree: &Tree) -> HistoryState {
        HistoryState {
            undo_label: tree.undo_label().map(str::to_string),
            redo_label: tree.redo_label().map(str::to_string),
            history_len: tree.history_len(),
            undo_labels: tree.undo_labels().map(str::to_string).collect(),
            redo_labels: tree.redo_labels().map(str::to_string).collect(),
        }
    }
}

/// After any write: tell the webview, and bring the Edit menu in line with the history.
fn changed(app: &AppHandle, commit: Option<Commit>) {
    if let Some(commit) = commit {
        let _ = app.emit("rhizome://commit", commit);
    }
    menu::sync_history(app);
}

fn run<T>(
    app: &AppHandle,
    doc: &Doc,
    f: impl FnOnce(&mut Tree) -> rhizome_core::Result<(T, Option<Commit>)>,
) -> Result<T, String> {
    let out = f(&mut doc.0.lock().expect("tree lock")).map_err(|e| e.to_string())?;
    changed(app, out.1);
    Ok(out.0)
}

#[tauri::command]
pub fn rhizome_history(doc: State<'_, Doc>) -> HistoryState {
    HistoryState::of(&doc.0.lock().expect("tree lock"))
}

#[tauri::command]
pub fn rhizome_add_note(app: AppHandle, doc: State<'_, Doc>) -> Result<NodeId, String> {
    run(&app, &doc, |t| t.edit("Add Note", |tx| tx.add_unique("/notes", "note", "note")))
}

#[tauri::command]
pub fn rhizome_set_body(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    body: String,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        let label = format!("Edit {}", leaf(&path));
        t.edit(&label, |tx| tx.set_value(path.as_str(), "body", Value::Text(body)))
    })
}

#[tauri::command]
pub fn rhizome_set_colour(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    colour: [f64; 4],
) -> Result<(), String> {
    run(&app, &doc, |t| {
        let label = format!("Colour {}", leaf(&path));
        t.edit(&label, |tx| tx.set_value(path.as_str(), "colour", Value::Colour(colour)))
    })
}

#[tauri::command]
pub fn rhizome_rename(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    name: String,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        let label = format!("Rename {}", leaf(&path));
        t.edit(&label, |tx| tx.rename(path.as_str(), &name))
    })
}

#[tauri::command]
pub fn rhizome_remove(app: AppHandle, doc: State<'_, Doc>, path: String) -> Result<(), String> {
    run(&app, &doc, |t| {
        let label = format!("Remove {}", leaf(&path));
        t.edit(&label, |tx| tx.remove(path.as_str()))
    })
}

fn leaf(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

/// Shared by the command and the menu item.
pub fn undo(app: &AppHandle) -> Result<(), String> {
    let doc = app.state::<Doc>();
    run(app, &doc, |t| t.undo().map(|c| ((), c)))
}

pub fn redo(app: &AppHandle) -> Result<(), String> {
    let doc = app.state::<Doc>();
    run(app, &doc, |t| t.redo().map(|c| ((), c)))
}

#[tauri::command]
pub fn rhizome_undo(app: AppHandle) -> Result<(), String> {
    undo(&app)
}

#[tauri::command]
pub fn rhizome_redo(app: AppHandle) -> Result<(), String> {
    redo(&app)
}
