//! What the generator reads: the nodes an app declares, each with its controls and the
//! words on them. Its JSON is the shape a rhizome `Schema` dumps (`types`, `values`,
//! `bindable`, …), so an app on rhizome can hand over its schema as it is; an app that
//! isn't can build a [`Catalogue`] by hand. Fields the generator doesn't use are ignored.

use std::collections::BTreeMap;

use serde::Deserialize;
use serde_json::Value as Json;

/// Every node an app documents.
#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
pub struct Catalogue {
    #[serde(default)]
    pub types: Vec<Node>,
}

/// One kind of node: one page.
#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
pub struct Node {
    /// The id, and the page's file name: `<name>.md`.
    pub name: String,
    #[serde(default)]
    pub label: Option<String>,
    /// One sentence: the page's lead and its line in the index.
    #[serde(default)]
    pub summary: Option<String>,
    /// The heading it sits under in the index.
    #[serde(default)]
    pub group: Option<String>,
    /// What the node is to someone browsing, such as `colour`. The index groups by it, and
    /// falls back to `group` for a node without one.
    #[serde(default)]
    pub category: Option<String>,
    /// Its controls, in the order the table lists them.
    #[serde(default)]
    pub values: Vec<Control>,
    #[serde(default)]
    pub refs: Vec<String>,
    #[serde(default)]
    pub slots: Vec<String>,
    /// What a binding from it carries, when it can be bound.
    #[serde(default)]
    pub bindable: Option<Vec<Control>>,
}

/// One control: one row of the table.
#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct Control {
    pub key: String,
    pub kind: Kind,
    pub default: Json,
    #[serde(default)]
    pub range: Option<(f64, f64)>,
    /// The range's top is a suggestion: the table says "or more".
    #[serde(default)]
    pub soft_max: bool,
    #[serde(default)]
    pub choices: Vec<String>,
    /// A display label for some of the choices, by choice. A choice with none shows as it is.
    #[serde(default)]
    pub choice_labels: BTreeMap<String, String>,
    #[serde(default)]
    pub len: Option<usize>,
    /// A name for each step of an int control, read instead of the number.
    #[serde(default)]
    pub names: Option<Vec<String>>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub unit: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Bool,
    Int,
    Float,
    Text,
    Choice,
    Vec2,
    Vec3,
    Colour,
    Floats,
    Shaped,
}

#[cfg(feature = "rhizome")]
impl From<&rhizome_core::Schema> for Catalogue {
    /// Through the schema's JSON, which this model reads as it is.
    fn from(schema: &rhizome_core::Schema) -> Self {
        let json = serde_json::to_value(schema).expect("a rhizome schema serialises");
        serde_json::from_value(json).expect("a rhizome schema reads as a catalogue")
    }
}
