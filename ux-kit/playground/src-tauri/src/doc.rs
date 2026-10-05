//! An in-memory rhizome tree of eight documents (and the layers the Card document holds, and the
//! op stack the Ops document holds), and the commands that read and edit it.
//!
//! Uses rhizome-core as it is: `Registry`, `Tree`, `Tree::rows`, `Op::Set` / `Op::Reset`
//! through `Tree::edit_ops` and `Tree::edit_coalesced`. The category and node types below are
//! made up for the playground, not an app's object model, except the three op types: their keys,
//! ranges, defaults and choices are Oblique's (`sidecar/ops/{cmyk_halftone,film_stock,levels}.py`). `tokens`, `fonts`, `messages` and `inspectors` hold no
//! values (the webview draws them from the kit's CSS); `primitives` and `card` hold values
//! of every kind the documents edit, and `graphics` holds three curves as shaped values. Edits are labelled; undo and redo are
//! `Tree::undo` / `Tree::redo`. A drag is a gesture (`Tree::begin` / `apply` / `end` / `cancel`):
//! live edits, one undo step. Every change emits `rhizome://commit` (the `Commit`) and
//! refreshes the Edit menu (app-kit's `refresh_history`). Undo and redo run through app-kit,
//! which calls the `History` impl below, from the menu or the toolbar.
//! TODO: move to rhizome-pom / rhizome-pom-tauri (open document, commit events,
//! undo wired to the Edit menu) once that exists; this is the hand-rolled version.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use preset_app_kit::{refresh_history, Document, History};
use rhizome_core::{
    Commit, Error, GestureId, NodeId, NodeType, Op, Origin, Registry, Row, Shape, Tree,
};
use serde_json::{json, Value as Json};
use tauri::{AppHandle, Emitter, Runtime, State};

/// `Tree` is `Send` but not `Sync`, so the one open tree sits behind a mutex. The second field is
/// the open gesture's id: `GestureId` doesn't cross IPC, so the webview just says begin / apply /
/// end / cancel and the id stays here. Lock the tree first, then the slot.
pub struct Doc(
    pub(crate) Mutex<Tree>,
    Mutex<Option<GestureId>>,
    Mutex<Meta>,
);

/// Where the document lives: its file, or its `Untitled-N` number while it has none.
/// Lock order: tree, then gesture slot, then meta.
pub(crate) struct Meta {
    path: Option<PathBuf>,
    untitled: u32,
}

impl Doc {
    /// The playground starts as `Untitled-1`, a sample tree with no history.
    pub fn sample() -> Doc {
        Doc(
            Mutex::new(sample_tree()),
            Mutex::new(None),
            Mutex::new(Meta {
                path: None,
                untitled: 1,
            }),
        )
    }
}

/// The sample tree, loaded back from its own file text so history starts empty and it is saved.
fn sample_tree() -> Tree {
    {
        let docs = &["documents"];
        let registry = Registry::builder()
            .category("documents", Origin::Loaded)
            .category("layers", Origin::Loaded)
            .category("stack", Origin::Loaded)
            .node(NodeType::new("tokens").in_categories(docs))
            .node(NodeType::new("fonts").in_categories(docs))
            .node(NodeType::new("card").in_categories(docs))
            .node(NodeType::new("messages").in_categories(docs))
            .node(NodeType::new("ops").in_categories(docs))
            .node(NodeType::new("inspectors").in_categories(docs))
            .node(
                NodeType::new("graphics")
                    .in_categories(docs)
                    .shaped("transfer", curve_shape())
                    .shaped("envelope", curve_shape())
                    .shaped("adsr", curve_shape()),
            )
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
            // Oblique's op params, one value per param, same keys, ranges and defaults. A colour
            // is the hex default as [r, g, b, 1]; an enum is a choice; `scale: spatial` and units
            // are in Oblique's descriptions, not its spec, so they live in the webview's schema.
            .node(
                NodeType::new("cmyk_halftone")
                    .in_categories(&["stack"])
                    .float("dot_size", 1.0..=200.0, 6.0)
                    .float("angle_c", 0.0..=90.0, 15.0)
                    .float("angle_m", 0.0..=90.0, 75.0)
                    .float("angle_y", 0.0..=90.0, 0.0)
                    .float("angle_k", 0.0..=90.0, 45.0)
                    .colour("ink_c", [0.0, 1.0, 1.0, 1.0])
                    .colour("ink_m", [1.0, 0.0, 1.0, 1.0])
                    .colour("ink_y", [1.0, 1.0, 0.0, 1.0])
                    .colour("ink_k", [0.0, 0.0, 0.0, 1.0])
                    .float("misregistration", 0.0..=8.0, 0.0)
                    .int("seed", 0..=i64::from(i32::MAX), 0)
                    .choice("mode", &["paper", "over"], "paper")
                    .bool("white_is_alpha", false)
                    .bool("spill", false),
            )
            .node(
                NodeType::new("film_stock")
                    .in_categories(&["stack"])
                    .choice(
                        "stock",
                        &[
                            "polaroid_600",
                            "sx70",
                            "cross_process",
                            "bleach_bypass",
                            "expired",
                        ],
                        "polaroid_600",
                    )
                    .float("amount", 0.0..=1.0, 1.0)
                    .float("grain", 0.0..=1.0, 0.5)
                    .float("vignette", 0.0..=1.0, 0.5)
                    .int("seed", 0..=i64::from(i32::MAX), 0),
            )
            .node(
                NodeType::new("levels")
                    .in_categories(&["stack"])
                    .float("black", 0.0..=255.0, 0.0)
                    .float("white", 0.0..=255.0, 255.0)
                    .float("gamma", 0.1..=5.0, 1.0),
            )
            .build()
            .expect("sample registry");

        let mut seed = Tree::new(registry.clone());
        seed.edit("Add documents", |tx| {
            tx.add("/documents", "tokens", "tokens")?;
            tx.add("/documents", "fonts", "fonts")?;
            tx.add("/documents", "primitives", "primitives")?;
            tx.add("/documents", "card", "card")?;
            tx.add("/documents", "messages", "messages")?;
            tx.add("/documents", "ops", "ops")?;
            tx.add("/documents", "inspectors", "inspectors")?;
            tx.add("/documents", "graphics", "graphics")?;
            // The Graphics document's curves: a gentle S, a pluck with a sustain, and an ADSR.
            for (key, value) in [
                (
                    "transfer",
                    json!({"points": [
                        {"x": 0.0, "y": 0.0, "basis": "monotone"},
                        {"x": 0.3, "y": 0.18, "basis": "monotone"},
                        {"x": 0.7, "y": 0.82, "basis": "monotone"},
                        {"x": 1.0, "y": 1.0, "basis": "monotone"},
                    ]}),
                ),
                (
                    "envelope",
                    json!({"points": [
                        {"x": 0.0, "y": 0.0, "basis": "linear", "tension": -0.4},
                        {"x": 0.05, "y": 1.0, "basis": "linear", "tension": -0.6},
                        {"x": 0.4, "y": 0.45, "basis": "catmull-rom"},
                        {"x": 0.8, "y": 0.6, "basis": "linear", "tension": -0.5},
                        {"x": 1.6, "y": 0.0, "basis": "linear"},
                    ], "sustain": 3}),
                ),
                (
                    "adsr",
                    json!({"points": [
                        {"x": 0.0, "y": 0.0, "basis": "linear"},
                        {"x": 0.1, "y": 1.0, "basis": "linear"},
                        {"x": 0.4, "y": 0.6, "basis": "linear"},
                        {"x": 1.0, "y": 0.0, "basis": "linear"},
                    ], "sustain": 2}),
                ),
            ] {
                tx.apply(&Op::Set {
                    at: "/documents/graphics".into(),
                    key: key.into(),
                    value,
                })?;
            }
            // The `stack` order on /stack is the stack's order, top to bottom.
            let ops = [
                tx.add("/stack", "cmyk_halftone", "cmyk_halftone")?,
                tx.add("/stack", "film_stock", "film_stock")?,
                tx.add("/stack", "levels", "levels")?,
            ];
            tx.set_order("/stack", STACK_ORDER, ops)?;
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
        tree
    }
}

/// A `@preset.nz/math` curve as rhizome checks it: points with a basis and an optional tension,
/// and an optional sustain index.
fn curve_shape() -> Shape {
    Shape::record([
        (
            "points",
            Shape::list(Shape::record([
                ("x", Shape::Float),
                ("y", Shape::Float),
                (
                    "basis",
                    Shape::choice(&["constant", "linear", "monotone", "catmull-rom"]),
                ),
                ("tension", Shape::optional(Shape::Float)),
            ])),
        ),
        ("sustain", Shape::optional(Shape::Int)),
    ])
}

/// Every node as a rhizome `Row`, in path order.
#[tauri::command]
pub fn rhizome_rows(doc: State<'_, Doc>) -> Vec<Row> {
    doc.0.lock().expect("tree lock").rows()
}

/// The Ops document's effect kinds with their menu label and category: the metadata each op
/// declares about itself (menu-standard decision 7), read by the Effect menu's `Add ▸`.
pub const EFFECTS: &[(&str, &str, &str)] = &[
    ("cmyk_halftone", "CMYK Halftone", "Print"),
    ("film_stock", "Film Stock", "Print"),
    ("levels", "Levels", "Tone"),
];

/// The named order on `/stack` that holds the Ops document's stack, top to bottom.
pub const STACK_ORDER: &str = "stack";

/// The stack as node ids, top to bottom: the `stack` order, then any op it misses in path order
/// (a file saved before the order existed).
fn stack(t: &Tree) -> Vec<NodeId> {
    let Some(owner) = t.at("/stack") else {
        return Vec::new();
    };
    let mut ids: Vec<NodeId> = owner.order(STACK_ORDER).iter().map(|n| n.id()).collect();
    for c in owner.children() {
        if !ids.contains(&c.id()) {
            ids.push(c.id());
        }
    }
    ids
}

fn effect_label(kind: &str) -> &str {
    EFFECTS
        .iter()
        .find(|(k, ..)| *k == kind)
        .map_or(kind, |(_, label, _)| label)
}

/// Effect > Add ▸: a new op of `kind` straight after `after`, or at the end of the stack
/// (menu-standard decision 6). Returns the new node's id, for the webview to select.
#[tauri::command]
pub fn effect_add(
    app: AppHandle,
    doc: State<'_, Doc>,
    kind: String,
    after: Option<NodeId>,
) -> Result<NodeId, String> {
    if !EFFECTS.iter().any(|(k, ..)| *k == kind) {
        return Err(format!("no effect kind {kind}"));
    }
    run(&app, &doc, |t| {
        let mut order = stack(t);
        let at = after
            .and_then(|a| order.iter().position(|id| *id == a))
            .map_or(order.len(), |i| i + 1);
        t.edit(&format!("Add {}", effect_label(&kind)), |tx| {
            let id = tx.add_unique("/stack", &kind, &kind)?;
            order.insert(at, id);
            tx.set_order("/stack", STACK_ORDER, order)?;
            Ok(id)
        })
    })
}

/// Effect > Remove Effect. Removing drops the op from the order too.
#[tauri::command]
pub fn effect_remove(app: AppHandle, doc: State<'_, Doc>, id: NodeId) -> Result<(), String> {
    run(&app, &doc, |t| {
        let kind = t
            .at(id)
            .map(|n| n.type_name().to_string())
            .unwrap_or_default();
        t.edit(&format!("Remove {}", effect_label(&kind)), |tx| {
            tx.remove(id)
        })
    })
}

/// Effect > Move Earlier (`by` -1) or Move Later (`by` 1). Does nothing at either end.
#[tauri::command]
pub fn effect_move(app: AppHandle, doc: State<'_, Doc>, id: NodeId, by: i32) -> Result<(), String> {
    run(&app, &doc, |t| {
        let mut order = stack(t);
        let Some(i) = order.iter().position(|o| *o == id) else {
            return Ok(((), None));
        };
        let j = i as i64 + i64::from(by);
        if j < 0 || j >= order.len() as i64 {
            return Ok(((), None));
        }
        order.swap(i, j as usize);
        let kind = t
            .at(id)
            .map(|n| n.type_name().to_string())
            .unwrap_or_default();
        let way = if by < 0 { "Earlier" } else { "Later" };
        t.edit(&format!("Move {} {way}", effect_label(&kind)), |tx| {
            tx.set_order("/stack", STACK_ORDER, order)
        })
    })
}

/// The open tree is the playground's `History`: app-kit reads the labels from it for the Edit
/// menu and the toolbar, and calls `undo` and `redo` from either. Each read takes the tree lock,
/// so `refresh_history` must never run while it is held (`run` below drops it first).
impl History for Doc {
    fn undo_label(&self) -> Option<String> {
        self.0
            .lock()
            .expect("tree lock")
            .undo_label()
            .map(str::to_string)
    }

    fn redo_label(&self) -> Option<String> {
        self.0
            .lock()
            .expect("tree lock")
            .redo_label()
            .map(str::to_string)
    }

    fn undo_labels(&self) -> Vec<String> {
        let tree = self.0.lock().expect("tree lock");
        tree.undo_labels().map(str::to_string).collect()
    }

    fn redo_labels(&self) -> Vec<String> {
        let tree = self.0.lock().expect("tree lock");
        tree.redo_labels().map(str::to_string).collect()
    }

    fn undo<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), String> {
        run(app, self, |t| t.undo().map(|c| ((), c)))
    }

    fn redo<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), String> {
        run(app, self, |t| t.redo().map(|c| ((), c)))
    }
}

/// The file extension rhizome files carry in the playground (rhizome-api.md names none; its golden
/// file is `acid.rhizome`).
pub const EXTENSION: &str = "rhizome";

/// Save, open and new: the playground's half of app-kit's file commands, over rhizome's
/// `Tree::serialise`, `Tree::load`, `mark_saved` and `is_unsaved`.
impl Document for Doc {
    fn is_unsaved(&self) -> bool {
        self.0.lock().expect("tree lock").is_unsaved()
    }

    fn path(&self) -> Option<PathBuf> {
        self.2.lock().expect("meta lock").path.clone()
    }

    fn untitled_number(&self) -> u32 {
        self.2.lock().expect("meta lock").untitled
    }

    fn save<R: Runtime>(&self, _app: &AppHandle<R>, path: &Path) -> Result<(), String> {
        let mut tree = self.0.lock().expect("tree lock");
        write_atomically(path, &tree.serialise())?;
        // Only after the write succeeded: a failed save leaves the document unsaved.
        tree.mark_saved();
        self.2.lock().expect("meta lock").path = Some(path.to_path_buf());
        Ok(())
    }

    fn open<R: Runtime>(&self, app: &AppHandle<R>, path: &Path) -> Result<(), String> {
        let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        let registry = self.0.lock().expect("tree lock").registry().clone();
        let (tree, _report) = Tree::load(&text, registry).map_err(|e| e.to_string())?;
        self.replace(app, tree, Some(path.to_path_buf()), 0);
        Ok(())
    }

    fn new_document<R: Runtime>(&self, app: &AppHandle<R>, untitled: u32) -> Result<(), String> {
        self.replace(app, sample_tree(), None, untitled);
        Ok(())
    }
}

impl Doc {
    /// Swap in another tree: any open gesture belonged to the old one, and the webview re-reads.
    fn replace<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        tree: Tree,
        path: Option<PathBuf>,
        untitled: u32,
    ) {
        {
            let mut t = self.0.lock().expect("tree lock");
            *t = tree;
            *self.1.lock().expect("gesture lock") = None;
            let mut meta = self.2.lock().expect("meta lock");
            meta.path = path;
            meta.untitled = untitled;
        }
        let _ = app.emit("rhizome://commit", json!({ "seq": 0, "label": "Replace" }));
    }
}

/// Write beside the target and rename over it, so a crash never leaves half a file.
fn write_atomically(path: &Path, text: &str) -> Result<(), String> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// After any write: tell the webview, and bring the Edit menu in line with the history.
fn changed<R: Runtime>(app: &AppHandle<R>, commit: Option<Commit>) {
    if let Some(commit) = commit {
        let _ = app.emit("rhizome://commit", commit);
    }
    refresh_history(app);
}

fn run<R: Runtime, T>(
    app: &AppHandle<R>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_stack_follows_its_order_and_the_order_survives_a_move() {
        let mut tree = sample_tree();
        let names = |t: &Tree| -> Vec<String> {
            stack(t)
                .into_iter()
                .map(|id| t.at(id).unwrap().name().to_string())
                .collect()
        };
        assert_eq!(names(&tree), ["cmyk_halftone", "film_stock", "levels"]);
        let mut order = stack(&tree);
        order.swap(0, 2);
        tree.edit("Move", |tx| tx.set_order("/stack", STACK_ORDER, order))
            .unwrap();
        assert_eq!(names(&tree), ["levels", "film_stock", "cmyk_halftone"]);
        tree.undo().unwrap();
        assert_eq!(names(&tree), ["cmyk_halftone", "film_stock", "levels"]);
    }
    use serde_json::json;

    #[test]
    fn sample_has_eight_documents_three_layers_three_ops_and_no_history() {
        let doc = Doc::sample();
        let tree = doc.0.lock().unwrap();
        let types: Vec<String> = tree
            .rows()
            .into_iter()
            .filter(|r| r.path.as_str().starts_with("/documents/"))
            .map(|r| r.type_name)
            .collect();
        assert_eq!(types.len(), 8);
        let layers = tree
            .rows()
            .into_iter()
            .filter(|r| r.type_name == "layer")
            .count();
        assert_eq!(layers, 3);
        let ops: Vec<String> = tree
            .rows()
            .into_iter()
            .filter(|r| r.path.as_str().starts_with("/stack/"))
            .map(|r| r.type_name)
            .collect();
        assert_eq!(
            ops,
            ["cmyk_halftone", "film_stock", "levels"],
            "stack order is path order"
        );
        assert_eq!(tree.history_len(), 0);
    }

    #[test]
    fn op_values_keep_oblique_ranges_and_an_int_refuses_a_fraction() {
        let doc = Doc::sample();
        let mut tree = doc.0.lock().unwrap();
        let set = |at: &str, key: &str, value: Json| Op::Set {
            at: at.into(),
            key: key.into(),
            value,
        };
        tree.edit_ops("ok", &[set("/stack/cmyk_halftone", "angle_k", json!(90.0))])
            .unwrap();
        assert!(tree
            .edit_ops(
                "high",
                &[set("/stack/cmyk_halftone", "angle_k", json!(91.0))]
            )
            .is_err());
        assert!(tree
            .edit_ops("low", &[set("/stack/levels", "gamma", json!(0.05))])
            .is_err());
        assert!(tree
            .edit_ops("frac", &[set("/stack/film_stock", "seed", json!(1.5))])
            .is_err());
        tree.edit_ops("seed", &[set("/stack/film_stock", "seed", json!(7))])
            .unwrap();
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
    fn a_curve_drag_is_one_undo_step_and_a_malformed_curve_is_refused() {
        let doc = Doc::sample();
        let mut tree = doc.0.lock().unwrap();
        let mut slot = None;
        let at = "/documents/graphics";
        let curve = |y: f64| json!({"points": [{"x": 0.0, "y": y, "basis": "linear"}]});
        gesture_begin(&mut tree, &mut slot, at, "transfer").unwrap();
        for y in [0.1, 0.2, 0.3] {
            gesture_apply(&mut tree, &slot, at.into(), "transfer".into(), curve(y)).unwrap();
        }
        gesture_end(&mut tree, &mut slot).unwrap();
        assert_eq!(tree.history_len(), 1, "the whole drag is one step");
        let bad = json!({"points": [{"x": 0.0, "y": 0.0, "basis": "cubic"}]});
        let set = Op::Set {
            at: at.into(),
            key: "transfer".into(),
            value: bad,
        };
        assert!(tree.edit_ops("bad", &[set]).is_err());
        assert_eq!(tree.history_len(), 1);
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

#[cfg(test)]
mod save_tests {
    use super::*;

    fn dir() -> PathBuf {
        let d = std::env::temp_dir().join(format!(
            "playground-doc-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::create_dir_all(&d);
        d
    }

    fn edit(doc: &Doc) {
        doc.0
            .lock()
            .unwrap()
            .edit_ops(
                "Set",
                &[Op::Set {
                    at: "/layers/figure".into(),
                    key: "opacity".into(),
                    value: json!(0.5),
                }],
            )
            .unwrap();
    }

    #[test]
    fn a_new_document_is_saved_an_edit_marks_it_and_saving_clears_it() {
        let doc = Doc::sample();
        assert!(!doc.is_unsaved());
        assert_eq!((doc.path(), doc.untitled_number()), (None, 1));
        edit(&doc);
        assert!(doc.is_unsaved());
        let path = dir().join("a.rhizome");
        write_then_mark(&doc, &path);
        assert!(!doc.is_unsaved());
        assert_eq!(doc.path(), Some(path.clone()));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn undoing_back_to_the_saved_state_clears_the_mark() {
        let doc = Doc::sample();
        edit(&doc);
        assert!(doc.is_unsaved());
        doc.0.lock().unwrap().undo().unwrap();
        assert!(!doc.is_unsaved());
    }

    #[test]
    fn what_is_saved_loads_back_identical_and_clean() {
        let doc = Doc::sample();
        edit(&doc);
        let path = dir().join("b.rhizome");
        write_then_mark(&doc, &path);
        let text = std::fs::read_to_string(&path).unwrap();
        let registry = doc.0.lock().unwrap().registry().clone();
        let (loaded, _) = Tree::load(&text, registry).unwrap();
        assert!(!loaded.is_unsaved());
        assert_eq!(loaded.serialise(), doc.0.lock().unwrap().serialise());
        assert_eq!(loaded.history_len(), 0);
        let _ = std::fs::remove_file(path);
    }

    /// `Document::save` without an app handle: the same steps.
    fn write_then_mark(doc: &Doc, path: &Path) {
        let mut tree = doc.0.lock().unwrap();
        write_atomically(path, &tree.serialise()).unwrap();
        tree.mark_saved();
        doc.2.lock().unwrap().path = Some(path.to_path_buf());
    }

    #[test]
    fn a_failed_write_leaves_the_document_unsaved() {
        let doc = Doc::sample();
        edit(&doc);
        let bad = dir().join("no-such-dir").join("x.rhizome");
        assert!(write_atomically(&bad, "x").is_err());
        assert!(doc.is_unsaved());
    }
}
