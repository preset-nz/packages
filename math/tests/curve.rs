//! Rust-only behaviour: the allocation-free buffers, sorting and serde shape.

use preset_math::*;

fn pt(x: f32, y: f32, basis: Basis) -> CurvePoint {
    CurvePoint {
        x,
        y,
        basis,
        tension: 0.0,
    }
}

#[test]
fn bake_reads_back() {
    let c = Curve {
        points: vec![
            pt(0.0, 0.0, Basis::Monotone),
            pt(0.5, 0.8, Basis::Monotone),
            pt(1.0, 1.0, Basis::Monotone),
        ],
        sustain: None,
    };
    let lut = c.bake(257);
    assert_eq!(lut.len(), 257);
    for i in 0..=36 {
        let x = i as f32 / 36.0;
        assert!((evaluate_baked(&lut, 0.0, 1.0, x) - c.evaluate(x)).abs() < 1e-4);
    }
}

#[test]
fn sort_points_keeps_sustain() {
    let mut c = Curve {
        points: vec![
            pt(0.9, 0.0, Basis::Linear),
            pt(0.0, 0.0, Basis::Linear),
            pt(0.4, 0.5, Basis::Linear),
        ],
        sustain: Some(2),
    };
    c.sort_points();
    assert_eq!(
        c.points.iter().map(|p| p.x).collect::<Vec<_>>(),
        vec![0.0, 0.4, 0.9]
    );
    assert_eq!(c.sustain, Some(1));
}

#[test]
fn serde_shape_matches_typescript() {
    let json = r#"{"points":[{"x":0,"y":0,"basis":"catmull-rom"},{"x":1,"y":1,"basis":"linear","tension":0.5}],"sustain":1}"#;
    let c: Curve = serde_json::from_str(json).unwrap();
    assert_eq!(c.points[0].basis, Basis::CatmullRom);
    assert_eq!(c.points[0].tension, 0.0);
    assert_eq!(c.points[1].tension, 0.5);
    assert_eq!(c.sustain, Some(1));
    let back = serde_json::to_string(&c).unwrap();
    let v: serde_json::Value = serde_json::from_str(&back).unwrap();
    assert!(
        v["points"][0].get("tension").is_none(),
        "zero tension is left out, as in TS"
    );
    assert_eq!(v["points"][1]["tension"], 0.5);
    assert!(back.contains(r#""basis":"catmull-rom""#));
}
