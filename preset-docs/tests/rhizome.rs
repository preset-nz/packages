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

#[test]
fn category_and_choice_labels_come_through() {
    let schema = Registry::builder()
        .category("things", Origin::Loaded)
        .node(
            NodeType::new("film")
                .category("colour")
                .choice("film.stock", &["sx70", "plain"], "plain")
                .choice_labels(&[("sx70", "Instant")]),
        )
        .node(NodeType::new("bare").float("bare.x", 0.0..=1.0, 0.0))
        .build()
        .unwrap()
        .schema();
    let catalogue = Catalogue::from(&schema);
    let film = catalogue.types.iter().find(|t| t.name == "film").unwrap();
    assert_eq!(film.category.as_deref(), Some("colour"));
    assert_eq!(film.values[0].choice_labels["sx70"], "Instant");
    let bare = catalogue.types.iter().find(|t| t.name == "bare").unwrap();
    assert_eq!(bare.category, None);
    assert!(bare.values[0].choice_labels.is_empty());
}
