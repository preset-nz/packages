use core::ops::{Add, Div, Mul, Neg, Sub};

mod sealed {
    pub trait Sealed {}
    impl Sealed for f32 {}
    impl Sealed for f64 {}
}

/// `f32` or `f64`. Sealed, so it can grow without breaking anyone.
pub trait Float:
    sealed::Sealed
    + Copy
    + PartialOrd
    + Add<Output = Self>
    + Sub<Output = Self>
    + Mul<Output = Self>
    + Div<Output = Self>
    + Neg<Output = Self>
{
    const ZERO: Self;
    const ONE: Self;
    const TWO: Self;
    const THREE: Self;
    const HALF: Self;

    fn min(self, other: Self) -> Self;
    fn max(self, other: Self) -> Self;
    fn powf(self, n: Self) -> Self;
    fn ln(self) -> Self;
}

macro_rules! impl_float {
    ($t:ty) => {
        impl Float for $t {
            const ZERO: Self = 0.0;
            const ONE: Self = 1.0;
            const TWO: Self = 2.0;
            const THREE: Self = 3.0;
            const HALF: Self = 0.5;

            #[inline]
            fn min(self, other: Self) -> Self {
                <$t>::min(self, other)
            }
            #[inline]
            fn max(self, other: Self) -> Self {
                <$t>::max(self, other)
            }
            #[inline]
            fn powf(self, n: Self) -> Self {
                <$t>::powf(self, n)
            }
            #[inline]
            fn ln(self) -> Self {
                <$t>::ln(self)
            }
        }
    };
}

impl_float!(f32);
impl_float!(f64);
