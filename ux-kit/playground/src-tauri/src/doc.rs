//! An in-memory rhizome tree of four documents (and the layers the Card document holds), and
//! the commands that read and edit it.
//!
//! Uses rhizome-core as it is: `Registry`, `Tree`, `Tree::rows`, `Op::Set` / `Op::Reset`
//! through `Tree::edit_ops` and `Tree::edit_coalesced`. The category and node types below are
//! made up for the playground, not an app's object model. `tokens` and `fonts` hold no
//! values (the webview draws them from the kit's CSS); `primitives` and `card` hold values
//! of every kind the documents edit. Edits are labelled; undo and redo are
//! `Tree::undo` / `Tree::redo`. A drag is a gesture (`Tree::begin` / `apply` / `end` / `cancel`):
//! live edits, one undo step. Every change emits `rhizome://commit` (the `Commit`) and
//! refreshes the Edit menu.
//! TODO: move to rhizome-pom / rhizome-pom-tauri (open document, commit events,
//! undo wired to the Edit menu) once that exists; this is the hand-rolled version.

use std::sync::Mutex;

use rhizome_core::{Commit, Error, GestureId, NodeType, Op, Origin, Registry, Row, Tree};
use serde::Serialize;
use serde_json::Value as Json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::menu;

/// `Tree` is `Send` but not `Sync`, so the one open tree sits behind a mutex. The second field is
/// the open gesture's id: `GestureId` doesn't cross IPC, so the webview just says begin / apply /
/// end / cancel and the id stays here. Lock the tree first, then the slot.
pub struct Doc(pub(crate) Mutex<Tree>, Mutex<Option<GestureId>>);

impl Doc {
    pub fn sample() -> Doc {
        let docs = &["documents"];
        let registry = Registry::builder()
            .category("documents", Origin::Loaded)
            .category("layers", Origin::Loaded)
            .node(NodeType::new("tokens").in_categories(docs))
            .node(NodeType::new("fonts").in_categories(docs))
            .node(NodeType::new("card").in_categories(docs))
            .node(
                NodeType::new("primitives")
                    .in_categories(docs)
                    .text("title", "Primitives")
                    .bool("visible", true)
                    .bool("locked", false)
                    .vec3("position", [0.0, 0.0, 0.0])
                    .vec2("size", [40.0, 60.0])
                    .floats("weights", &[0.25, 0.25, 0.25, 0.25])
                    .text("notes", ""),
            )
            .node(
                NodeType::new("layer")
                    .in_categories(&["layers"])
                    .text("name", "Layer")
                    .bool("visible", true)
                    .float("opacity", 0.0..=1.0, 1.0)
                    .choice(
                        "blend",
                        &["normal", "multiply", "screen", "overlay"],
                        "normal",
                    )
                    .colour("tint", [0.24, 0.39, 0.87, 1.0])
                    .vec2("offset", [0.0, 0.0])
                    .float("rotation", -180.0..=180.0, 0.0)
                    .text("notes", ""),
            )
            .build()
            .expect("sample registry");

        let mut seed = Tree::new(registry.clone());
        seed.edit("Add documents", |tx| {
            tx.add("/documents", "tokens", "tokens")?;
            tx.add("/documents", "fonts", "fonts")?;
            tx.add("/documents", "primitives", "primitives")?;
            tx.add("/documents", "card", "card")?;
            tx.add("/layers", "layer", "background")?;
            tx.add("/layers", "layer", "figure")?;
            tx.add("/layers", "layer", "shadow")?;
            for (path, name) in [
                ("/layers/background", "Background"),
                ("/layers/figure", "Figure"),
                ("/layers/shadow", "Shadow"),
            ] {
                tx.apply(&Op::Set {
                    at: path.into(),
                    key: "name".into(),
                    value: Json::from(name),
                })?;
            }
            Ok(())
        })
        .expect("sample documents");
        // Load the seed back so history starts empty: undo must not remove the documents.
        let (tree, _report) = Tree::load(&seed.serialise(), registry).expect("seed loads");

        Doc(Mutex::new(tree), Mutex::new(None))
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

/// The registry as plain data (`Registry::schema`): each node type's values with kind, default,
/// range and choices, so the webview can show a value's default without copying it.
#[tauri::command]
pub fn rhizome_schema(doc: State<'_, Doc>) -> rhizome_core::Schema {
    doc.0.lock().expect("tree lock").registry().schema()
}

#[tauri::command]
pub fn rhizome_history(doc: State<'_, Doc>) -> HistoryState {
    HistoryState::of(&doc.0.lock().expect("tree lock"))
}

/// Sets one value, as one labelled edit. `coalesce` is for input that arrives as a stream (a
/// slider, typing in a number field): consecutive sets of the same key share one undo step
/// (`Tree::edit_coalesced`). `value` is plain JSON, read against the node's schema.
#[tauri::command]
pub fn rhizome_set(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    key: String,
    value: Json,
    coalesce: bool,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        let label = format!("Set {key} of {}", leaf(&path));
        let coalesce_key = format!("{path}:{key}");
        let op = Op::Set {
            at: path,
            key,
            value,
        };
        if coalesce {
            t.edit_coalesced(&label, &coalesce_key, |tx| tx.apply(&op).map(|_| ()))
        } else {
            t.edit(&label, |tx| tx.apply(&op).map(|_| ()))
        }
    })
}

/// Opens a gesture for a drag on one value: edits applied through `rhizome_gesture_apply` show at
/// once and become one undo step at `rhizome_gesture_end`. Labelled like a single set.
#[tauri::command]
pub fn rhizome_gesture_begin(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    key: String,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        gesture_begin(t, &mut doc.1.lock().expect("gesture lock"), &path, &key)
    })
}

/// Sets the value inside the open gesture. One commit per call, no undo step of its own.
#[tauri::command]
pub fn rhizome_gesture_apply(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    key: String,
    value: Json,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        gesture_apply(t, &doc.1.lock().expect("gesture lock"), path, key, value)
    })
}

/// Closes the gesture: its edits are one undo step (none if nothing changed).
#[tauri::command]
pub fn rhizome_gesture_end(app: AppHandle, doc: State<'_, Doc>) -> Result<(), String> {
    run(&app, &doc, |t| {
        gesture_end(t, &mut doc.1.lock().expect("gesture lock"))
    })
}

/// Closes the gesture and puts everything back as it was at `begin`.
#[tauri::command]
pub fn rhizome_gesture_cancel(app: AppHandle, doc: State<'_, Doc>) -> Result<(), String> {
    run(&app, &doc, |t| {
        gesture_cancel(t, &mut doc.1.lock().expect("gesture lock"))
    })
}

type Done = rhizome_core::Result<((), Option<Commit>)>;

fn gesture_begin(t: &mut Tree, slot: &mut Option<GestureId>, path: &str, key: &str) -> Done {
    *slot = Some(t.begin(&format!("Set {key} of {}", leaf(path)))?);
    Ok(((), None))
}

fn gesture_apply(
    t: &mut Tree,
    slot: &Option<GestureId>,
    path: String,
    key: String,
    value: Json,
) -> Done {
    let g = slot.ok_or(Error::NoGesture)?;
    let commit = t.apply(
        g,
        &[Op::Set {
            at: path,
            key,
            value,
        }],
    )?;
    Ok(((), commit))
}

fn gesture_end(t: &mut Tree, slot: &mut Option<GestureId>) -> Done {
    let g = slot.take().ok_or(Error::NoGesture)?;
    t.end(g)?;
    Ok(((), None))
}

fn gesture_cancel(t: &mut Tree, slot: &mut Option<GestureId>) -> Done {
    let g = slot.take().ok_or(Error::NoGesture)?;
    Ok(((), t.cancel(g)?))
}

/// Resets values of a node to their defaults, as one edit: the `keys` given, or every value
/// when there are none.
#[tauri::command]
pub fn rhizome_reset(
    app: AppHandle,
    doc: State<'_, Doc>,
    path: String,
    keys: Option<Vec<String>>,
) -> Result<(), String> {
    run(&app, &doc, |t| {
        let keys: Vec<String> = keys.unwrap_or_else(|| {
            t.at(path.as_str())
                .and_then(|n| {
                    n.node_type()
                        .map(|nt| nt.values().iter().map(|v| v.key.clone()).collect())
                })
                .unwrap_or_default()
        });
        let ops: Vec<Op> = keys
            .into_iter()
            .map(|key| Op::Reset {
                at: path.clone(),
                key,
            })
            .collect();
        let label = match keys_label(&ops) {
            Some(key) => format!("Reset {key} of {}", leaf(&path)),
            None => format!("Reset {}", leaf(&path)),
        };
        t.edit(&label, |tx| {
            ops.iter().try_for_each(|op| tx.apply(op).map(|_| ()))
        })
    })
}

/// The key, when a reset touches exactly one.
fn keys_label(ops: &[Op]) -> Option<&str> {
    match ops {
        [Op::Reset { key, .. }] => Some(key),
        _ => None,
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sample_has_four_documents_three_layers_and_no_history() {
        let doc = Doc::sample();
        let tree = doc.0.lock().unwrap();
        let types: Vec<String> = tree
            .rows()
            .into_iter()
            .filter(|r| r.path.as_str().starts_with("/documents/"))
            .map(|r| r.type_name)
            .collect();
        assert_eq!(types.len(), 4);
        let layers = tree
            .rows()
            .into_iter()
            .filter(|r| r.type_name == "layer")
            .count();
        assert_eq!(layers, 3);
        assert_eq!(tree.history_len(), 0);
    }

    #[test]
    fn vector_and_list_values_set_and_reset_as_one_step() {
        let doc = Doc::sample();
        let mut tree = doc.0.lock().unwrap();
        let set = |key: &str, value: Json| Op::Set {
            at: "/documents/primitives".into(),
            key: key.into(),
            value,
        };
        tree.edit_ops(
            "Set",
            &[
                set("position", json!([1.0, 2.0, 3.0])),
                set("weights", json!([1, 0, 0, 0])),
            ],
        )
        .unwrap();
        assert_eq!(tree.undo_labels().count(), 1);
        let reset: Vec<Op> = ["position", "weights"]
            .iter()
            .map(|k| Op::Reset {
                at: "/documents/primitives".into(),
                key: (*k).into(),
            })
            .collect();
        tree.edit_ops("Reset", &reset).unwrap();
        assert_eq!(tree.undo_labels().count(), 2);
        // A value of the wrong length is refused.
        assert!(tree
            .edit_ops("Bad", &[set("weights", json!([1, 2]))])
            .is_err());
    }

    fn set_at(key: &str, value: Json) -> (String, String, Json) {
        ("/documents/primitives".into(), key.into(), value)
    }

    #[test]
    fn a_drag_is_live_but_one_undo_step_and_cancel_leaves_none() {
        let doc = Doc::sample();
        let mut tree = doc.0.lock().unwrap();
        let mut slot = None;
        let path = "/documents/primitives";

        gesture_begin(&mut tree, &mut slot, path, "position").unwrap();
        for x in [1.0, 2.0, 3.0] {
            let (p, k, v) = set_at("position", json!([x, 0.0, 0.0]));
            let (_, commit) = gesture_apply(&mut tree, &slot, p, k, v).unwrap();
            assert!(commit.is_some(), "each apply commits, so the panel follows");
        }
        assert_eq!(tree.history_len(), 0, "no undo step until end");
        gesture_end(&mut tree, &mut slot).unwrap();
        assert_eq!(tree.history_len(), 1);
        assert_eq!(tree.undo_label(), Some("Set position of primitives"));

        tree.undo().unwrap();
        let value = |t: &Tree| {
            t.rows()
                .into_iter()
                .find(|r| r.path.as_str() == path)
                .unwrap()
                .values["position"]
                .clone()
        };
        assert_eq!(
            value(&tree),
            json!([0.0, 0.0, 0.0]),
            "one undo reverts the whole drag"
        );

        gesture_begin(&mut tree, &mut slot, path, "position").unwrap();
        let (p, k, v) = set_at("position", json!([9.0, 9.0, 9.0]));
        gesture_apply(&mut tree, &slot, p, k, v).unwrap();
        gesture_cancel(&mut tree, &mut slot).unwrap();
        assert_eq!(value(&tree), json!([0.0, 0.0, 0.0]));
        assert_eq!(
            tree.history_len(),
            0,
            "the redo of the first drag is all that is left"
        );
        assert!(
            gesture_end(&mut tree, &mut slot).is_err(),
            "no gesture is open"
        );
    }
}
