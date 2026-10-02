//! An in-memory rhizome tree with a few sample nodes, and one command to list them.
//!
//! Uses rhizome-core as it is: `Registry`, `Tree`, `Edit::add`, `Tree::rows`. The node
//! type and category below are made up for the playground, not an app's object model.
//! TODO: move to rhizome-pom / rhizome-pom-tauri (open document, commit events,
//! undo wired to the Edit menu) once the playground shows composites that edit.

use std::sync::Mutex;

use rhizome_core::{NodeType, Origin, Registry, Row, Tree, Value};
use tauri::State;

/// `Tree` is `Send` but not `Sync`, so the one open tree sits behind a mutex.
pub struct Doc(Mutex<Tree>);

impl Doc {
    pub fn sample() -> Doc {
        let registry = Registry::builder()
            .category("notes", Origin::Loaded)
            .node(
                NodeType::new("note")
                    .in_categories(&["notes"])
                    .text("body", ""),
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
