//! The Rust half against the fixtures generated from the TypeScript half.
//! Passing means the two compute the same numbers, to the stated tolerance.

use preset_math::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct Scalars {
    tolerance: f64,
    cases: Vec<ScalarCase>,
}

#[derive(Deserialize)]
struct ScalarCase {
    #[serde(rename = "fn")]
    func: String,
    args: Vec<f64>,
    expected: f64,
}

#[derive(Deserialize)]
struct Curves {
    tolerance: f32,
    cases: Vec<CurveCase>,
}

#[derive(Deserialize)]
struct CurveCase {
    name: String,
    curve: Curve,
    samples: Vec<Sample>,
    #[serde(default)]
    envelope: Vec<EnvSample>,
}

#[derive(Deserialize)]
struct Sample {
    x: f32,
    y: f32,
}

#[derive(Deserialize)]
struct EnvSample {
    t: f32,
    release: Option<f32>,
    y: f32,
}

fn load<T: for<'de> Deserialize<'de>>(file: &str) -> T {
    let path = format!("{}/fixtures/{file}", env!("CARGO_MANIFEST_DIR"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

/// Calls a scalar function by its fixture name, generic so both widths run.
fn call<T: Float + From<f32>>(name: &str, a: &[T]) -> T {
    match (name, a) {
        ("lerp", &[x, y, z]) => lerp(x, y, z),
        ("invlerp", &[x, y, z]) => invlerp(x, y, z),
        ("clamp", &[x, y, z]) => clamp(x, y, z),
        ("fit", &[v, a, b, c, d]) => fit(v, a, b, c, d),
        ("fitUnclamped", &[v, a, b, c, d]) => fit_unclamped(v, a, b, c, d),
        ("fit01", &[v, a, b]) => fit01(v, a, b),
        ("fit10", &[v, a, b]) => fit10(v, a, b),
        ("fit11", &[v, a, b]) => fit11(v, a, b),
        ("smooth", &[a, b, v]) => smooth(a, b, v),
        ("bias", &[v, b]) => bias(v, b),
        ("gain", &[v, g]) => gain(v, g),
        ("biasPerlin", &[v, b]) => bias_perlin(v, b),
        ("gainPerlin", &[v, g]) => gain_perlin(v, g),
        _ => panic!("no scalar function {name} with {} arguments", a.len()),
    }
}

#[test]
fn scalars_match_typescript_in_f64() {
    let s: Scalars = load("scalars.json");
    for c in &s.cases {
        let got = call::<f64>(&c.func, &c.args);
        assert!(
            (got - c.expected).abs() <= s.tolerance,
            "{}({:?}) = {got}, expected {}",
            c.func,
            c.args,
            c.expected
        );
    }
}

#[test]
fn scalars_match_typescript_in_f32() {
    let s: Scalars = load("scalars.json");
    for c in &s.cases {
        let args: Vec<f32> = c.args.iter().map(|&v| v as f32).collect();
        let got = call::<f32>(&c.func, &args) as f64;
        assert!(
            (got - c.expected).abs() <= s.tolerance,
            "{}({:?}) = {got}, expected {}",
            c.func,
            c.args,
            c.expected
        );
    }
}

#[test]
fn curves_match_typescript() {
    let s: Curves = load("curves.json");
    for c in &s.cases {
        for p in &c.samples {
            let got = c.curve.evaluate(p.x);
            assert!(
                (got - p.y).abs() <= s.tolerance,
                "{}: evaluate({}) = {got}, expected {}",
                c.name,
                p.x,
                p.y
            );
        }
        for e in &c.envelope {
            let got = c.curve.evaluate_envelope(e.t, e.release);
            assert!(
                (got - e.y).abs() <= s.tolerance,
                "{}: evaluate_envelope({}, {:?}) = {got}, expected {}",
                c.name,
                e.t,
                e.release,
                e.y
            );
        }
    }
}
