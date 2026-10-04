//! Value shaping for the preset.nz desktop apps.
//!
//! Scalar functions (`fit`, `lerp`, `smooth`, `bias`, `gain`, …) and one
//! [`Curve`] that evaluates to the same numbers here and in the TypeScript
//! half (`@preset.nz/math`). Both halves are pinned by `fixtures/*.json`.
//!
//! The scalars are generic over [`Float`] (`f32` and `f64`). The curve is
//! `f32`: everything that runs one (audio, image tables, shaders) is.
//!
//! No dependencies; `serde` derives on the curve behind the `serde` feature.

mod curve;
mod float;
mod scalar;

pub use curve::{evaluate_baked, tension_warp, Basis, Curve, CurvePoint, TENSION_STRENGTH};
pub use float::Float;
pub use scalar::{
    bias, bias_perlin, clamp, fit, fit_unclamped, gain, gain_perlin, invlerp, lerp, smooth,
};
