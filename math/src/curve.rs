//! The curve: points with a basis per point, plus segment tension and a sustain point for envelopes.
//!
//! Mirrors `src-ts/curve.ts` in `f32`; both are pinned by
//! `fixtures/curves.json`. Evaluation never allocates, so it is safe on the
//! audio thread.

use crate::scalar::{clamp, lerp};

/// Interpolation from a point to the next.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "kebab-case"))]
pub enum Basis {
    /// Holds this point's value until the next point.
    Constant,
    /// Straight, or bent by the point's tension.
    #[default]
    Linear,
    /// Smooth and never outside its endpoints (PCHIP).
    Monotone,
    /// Smooth through its neighbours; may overshoot.
    CatmullRom,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CurvePoint {
    pub x: f32,
    pub y: f32,
    /// Interpolation from this point to the next. Ignored on the last point.
    pub basis: Basis,
    /// Bend of the segment to the next point, -1..1; 0 is straight. Only on
    /// a linear segment. Positive is slow then fast, negative fast then slow.
    #[cfg_attr(feature = "serde", serde(default, skip_serializing_if = "is_zero"))]
    pub tension: f32,
}

#[cfg(feature = "serde")]
fn is_zero(v: &f32) -> bool {
    *v == 0.0
}

#[derive(Clone, Debug, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Curve {
    /// Sorted by x (see [`Curve::sort_points`]). Equal x makes a step.
    pub points: Vec<CurvePoint>,
    /// Index of the point an envelope holds at while the gate is down.
    #[cfg_attr(
        feature = "serde",
        serde(default, skip_serializing_if = "Option::is_none")
    )]
    pub sustain: Option<usize>,
}

/// How far tension ±1 bends a segment. At +1 a segment's midpoint sits about
/// 5% of the way up; at +0.5, about 18%.
pub const TENSION_STRENGTH: f32 = 6.0;

/// The exponential warp of a segment's local `t`. Monotone for any tension.
#[inline]
pub fn tension_warp(t: f32, tension: f32) -> f32 {
    let k = clamp(tension, -1.0, 1.0) * TENSION_STRENGTH;
    if k.abs() < 1e-4 {
        return t;
    }
    (k * t).exp_m1() / k.exp_m1()
}

impl Curve {
    /// The curve's value at `x`. Before the first point it holds the first
    /// `y`, after the last point the last `y`. On a step the later point
    /// wins. Assumes sorted points; an empty curve is 0.
    pub fn evaluate(&self, x: f32) -> f32 {
        if self.points.is_empty() {
            return 0.0;
        }
        eval_range(&self.points, x, None)
    }

    /// An envelope's value at time `t`. Without a sustain point this is
    /// [`Curve::evaluate`]. With one: while the gate is down (`release` is
    /// `None`, or `t < release`) the curve plays up to the sustain point and
    /// holds its `y`. From `release` on, the points after the sustain point
    /// play, shifted to start at `release`, with the first release segment
    /// starting from the level reached at `release`.
    pub fn evaluate_envelope(&self, t: f32, release: Option<f32>) -> f32 {
        let n = self.points.len();
        if n == 0 {
            return 0.0;
        }
        let Some(s) = self.sustain.filter(|&s| s < n) else {
            return self.evaluate(t);
        };
        let sp = self.points[s];
        let held = |u: f32| {
            if u < sp.x {
                eval_range(&self.points, u, None)
            } else {
                sp.y
            }
        };
        let Some(r) = release.filter(|&r| t >= r) else {
            return held(t);
        };
        let level = held(r);
        if s == n - 1 {
            return level;
        }
        eval_range(&self.points[s..], sp.x + (t - r), Some(level))
    }

    /// `n` evenly spaced samples from the first point's x to the last's.
    pub fn bake(&self, n: usize) -> Vec<f32> {
        let mut out = vec![0.0; n];
        self.bake_into(&mut out);
        out
    }

    /// [`Curve::bake`] into a buffer you own, sized by its length.
    pub fn bake_into(&self, out: &mut [f32]) {
        let (Some(first), Some(last)) = (self.points.first(), self.points.last()) else {
            out.fill(0.0);
            return;
        };
        self.bake_range_into(first.x, last.x, out);
    }

    /// Evenly spaced samples of [`Curve::evaluate`] from `x0` to `x1`, both
    /// included, into a buffer you own.
    pub fn bake_range_into(&self, x0: f32, x1: f32, out: &mut [f32]) {
        let n = out.len();
        for (i, v) in out.iter_mut().enumerate() {
            let x = if n == 1 {
                x0
            } else {
                lerp(x0, x1, i as f32 / (n - 1) as f32)
            };
            *v = self.evaluate(x);
        }
    }

    /// Stably sorts the points by x, keeping `sustain` on its point.
    pub fn sort_points(&mut self) {
        let mut order: Vec<usize> = (0..self.points.len()).collect();
        order.sort_by(|&a, &b| self.points[a].x.total_cmp(&self.points[b].x));
        self.sustain = self
            .sustain
            .and_then(|s| order.iter().position(|&i| i == s));
        self.points = order.iter().map(|&i| self.points[i]).collect();
    }
}

/// Reads a table from [`Curve::bake`] back at `x`, linearly between samples,
/// holding the ends outside `[x0, x1]`.
pub fn evaluate_baked(lut: &[f32], x0: f32, x1: f32, x: f32) -> f32 {
    match lut.len() {
        0 => 0.0,
        1 => lut[0],
        _ if x1 == x0 => lut[0],
        n => {
            let p = clamp((x - x0) / (x1 - x0), 0.0, 1.0) * (n - 1) as f32;
            let i = (p as usize).min(n - 2);
            lerp(lut[i], lut[i + 1], p - i as f32)
        }
    }
}

/// The core: evaluates `pts` as a curve of its own, with the first point's
/// `y` replaced by `start_y` when given (an envelope's release).
fn eval_range(pts: &[CurvePoint], x: f32, start_y: Option<f32>) -> f32 {
    let hi = pts.len() - 1;
    let px = |i: usize| pts[i].x;
    let py = |i: usize| match (i, start_y) {
        (0, Some(y)) => y,
        _ => pts[i].y,
    };

    if x < px(0) {
        return py(0);
    }
    if x >= px(hi) {
        return py(hi);
    }

    // Largest i in [0, hi - 1] with x_i <= x. Then x_{i+1} > x, so the
    // segment has width, and on a step the later point wins.
    let (mut a, mut b) = (0, hi - 1);
    while a < b {
        let mid = (a + b).div_ceil(2);
        if px(mid) <= x {
            a = mid;
        } else {
            b = mid - 1;
        }
    }
    let i = a;
    let p = pts[i];
    let (x0, x1, y0, y1) = (px(i), px(i + 1), py(i), py(i + 1));
    let h = x1 - x0;
    let t = (x - x0) / h;

    // Slope of segment k, or None outside the range or on a step.
    let secant = |k: isize| -> Option<f32> {
        if k < 0 || k as usize >= hi {
            return None;
        }
        let k = k as usize;
        let w = px(k + 1) - px(k);
        (w > 0.0).then(|| (py(k + 1) - py(k)) / w)
    };
    // The tangent at point k. One-sided at the ends and beside a step.
    let tangent = |k: usize, basis: Basis| -> f32 {
        let (left, right) = (secant(k as isize - 1), secant(k as isize));
        match (left, right) {
            (None, r) => r.unwrap_or(0.0),
            (Some(l), None) => l,
            (Some(l), Some(r)) => {
                if basis == Basis::CatmullRom {
                    return (py(k + 1) - py(k - 1)) / (px(k + 1) - px(k - 1));
                }
                if l * r <= 0.0 {
                    return 0.0;
                }
                let h0 = px(k) - px(k - 1);
                let h1 = px(k + 1) - px(k);
                let w1 = 2.0 * h1 + h0;
                let w2 = h1 + 2.0 * h0;
                (w1 + w2) / (w1 / l + w2 / r)
            }
        }
    };

    match p.basis {
        Basis::Constant => y0,
        Basis::Linear => lerp(y0, y1, tension_warp(t, p.tension)),
        Basis::Monotone | Basis::CatmullRom => {
            let m0 = tangent(i, p.basis) * h;
            let m1 = tangent(i + 1, p.basis) * h;
            hermite(y0, y1, m0, m1, t)
        }
    }
}

/// Cubic Hermite on `t` in [0, 1], with tangents already scaled by the width.
#[inline]
fn hermite(y0: f32, y1: f32, m0: f32, m1: f32, t: f32) -> f32 {
    let t2 = t * t;
    let t3 = t2 * t;
    (2.0 * t3 - 3.0 * t2 + 1.0) * y0
        + (t3 - 2.0 * t2 + t) * m0
        + (-2.0 * t3 + 3.0 * t2) * y1
        + (t3 - t2) * m1
}
