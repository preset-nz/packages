//! Scalar shaping: interpolate, remap, ease, bias and gain. Names and argument
//! order follow Houdini's VEX where it has the function.
//!
//! Mirrors `src-ts/scalar.ts`; both are pinned by `fixtures/scalars.json`.

use crate::Float;

/// `a + t * (b - a)`. Unclamped.
#[inline]
pub fn lerp<T: Float>(a: T, b: T, t: T) -> T {
    a + t * (b - a)
}

/// Where `v` sits between `min` and `max`: the inverse of [`lerp`].
/// Unclamped. When `min == max` it returns 0.5, as VEX does.
#[inline]
pub fn invlerp<T: Float>(v: T, min: T, max: T) -> T {
    if min == max {
        return T::HALF;
    }
    (v - min) / (max - min)
}

/// `v` limited to `[min, max]`.
#[inline]
pub fn clamp<T: Float>(v: T, min: T, max: T) -> T {
    v.max(min).min(max)
}

/// Maps `v` from `[omin, omax]` to `[nmin, nmax]`, clamped to the old range.
/// A degenerate old range gives the midpoint of the new one.
#[inline]
pub fn fit<T: Float>(v: T, omin: T, omax: T, nmin: T, nmax: T) -> T {
    lerp(nmin, nmax, clamp(invlerp(v, omin, omax), T::ZERO, T::ONE))
}

/// [`fit`] without the clamp: values outside the old range extrapolate.
#[inline]
pub fn efit<T: Float>(v: T, omin: T, omax: T, nmin: T, nmax: T) -> T {
    lerp(nmin, nmax, invlerp(v, omin, omax))
}

/// `[0, 1]` to `[nmin, nmax]`, clamped.
#[inline]
pub fn fit01<T: Float>(v: T, nmin: T, nmax: T) -> T {
    fit(v, T::ZERO, T::ONE, nmin, nmax)
}

/// `[1, 0]` to `[nmin, nmax]`, clamped: 1 maps to `nmin`, 0 to `nmax`.
#[inline]
pub fn fit10<T: Float>(v: T, nmin: T, nmax: T) -> T {
    fit(v, T::ONE, T::ZERO, nmin, nmax)
}

/// `[-1, 1]` to `[nmin, nmax]`, clamped.
#[inline]
pub fn fit11<T: Float>(v: T, nmin: T, nmax: T) -> T {
    fit(v, -T::ONE, T::ONE, nmin, nmax)
}

/// 0 at or below `min`, 1 at or above `max`, and an ease in and out between
/// (`3t² − 2t³`).
#[inline]
pub fn smooth<T: Float>(min: T, max: T, v: T) -> T {
    if v <= min {
        return T::ZERO;
    }
    if v >= max {
        return T::ONE;
    }
    let t = (v - min) / (max - min);
    t * t * (T::THREE - T::TWO * t)
}

/// Schlick's bias (Graphics Gems IV, 1994): bends `[0, 1]` towards 1 when
/// `b > 0.5` and towards 0 when `b < 0.5`; 0.5 is the identity. No `pow`.
/// `v` and `b` are clamped to `[0, 1]`.
#[inline]
pub fn bias<T: Float>(v: T, b: T) -> T {
    let x = clamp(v, T::ZERO, T::ONE);
    let k = clamp(b, T::ZERO, T::ONE);
    if x == T::ZERO || x == T::ONE {
        return x;
    }
    if k == T::ZERO {
        return T::ZERO;
    }
    if k == T::ONE {
        return T::ONE;
    }
    x / ((T::ONE / k - T::TWO) * (T::ONE - x) + T::ONE)
}

/// Schlick's gain: two mirrored halves of [`bias`]. `g > 0.5` steepens the
/// middle into an S, `g < 0.5` flattens it; 0.5 is the identity.
#[inline]
pub fn gain<T: Float>(v: T, g: T) -> T {
    mirrored(v, g, bias)
}

/// Perlin's bias (An Image Synthesizer, SIGGRAPH 1985): `v^(ln b / ln 0.5)`.
/// Draws a different curve from [`bias`] for the same `b`.
#[inline]
pub fn bias_perlin<T: Float>(v: T, b: T) -> T {
    let x = clamp(v, T::ZERO, T::ONE);
    let k = clamp(b, T::ZERO, T::ONE);
    if x == T::ZERO || x == T::ONE {
        return x;
    }
    if k == T::ZERO {
        return T::ZERO;
    }
    if k == T::ONE {
        return T::ONE;
    }
    x.powf(k.ln() / T::HALF.ln())
}

/// Perlin's gain: two mirrored halves of [`bias_perlin`].
#[inline]
pub fn gain_perlin<T: Float>(v: T, g: T) -> T {
    mirrored(v, g, bias_perlin)
}

#[inline]
fn mirrored<T: Float>(v: T, g: T, bias: fn(T, T) -> T) -> T {
    let x = clamp(v, T::ZERO, T::ONE);
    let k = T::ONE - g;
    if x < T::HALF {
        bias(T::TWO * x, k) / T::TWO
    } else {
        T::ONE - bias(T::TWO - T::TWO * x, k) / T::TWO
    }
}
