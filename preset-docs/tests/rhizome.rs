//! The `rhizome` feature: a rhizome schema becomes a catalogue with nothing lost that the
//! generator reads.

use preset_docs::{Catalogue, Kind};
use rhizome_core::{NodeType, Origin, Registry};

#[test]
fn a_rhizome_schema_becomes_a_catalogue() {
    let schema = Registry::builder()
        .category("things", Origin::Loaded)
        .node(NodeType::new("widget").float("widget.size", 0.5..=20.0, 1.0))
        .build()
        .unwrap()
        .schema();
    let catalogue = Catalogue::from(&schema);
    let widget = &catalogue.types[0];
    assert_eq!(widget.name, "widget");
    assert_eq!(widget.values[0].key, "widget.size");
    assert_eq!(widget.values[0].kind, Kind::Float);
    assert_eq!(widget.values[0].range, Some((0.5, 20.0)));
}
