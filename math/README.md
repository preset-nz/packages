# math

Value shaping for the preset.nz desktop apps, in TypeScript and Rust, with the same results from both.

- **Scalars:** `lerp`, `invlerp`, `clamp`, `fit`, `fitUnclamped`, `smooth`, `bias`, `gain`, `biasPerlin`, `gainPerlin`.
- **Curve:** points with an interpolation each (constant, linear, monotone, Catmull-Rom), tension on linear segments, and a sustain point for envelopes. `evaluate`, `evaluateEnvelope`, `bake`, `bakeRange`, `evaluateBaked` and `sortPoints`.

## TypeScript

```sh
pnpm add @preset.nz/math
```

```ts
import { evaluate, fit, type Curve } from "@preset.nz/math";

fit(0.3, 0, 1, 10, 20); // 13, clamped to the old range

const curve: Curve = {
  points: [
    { x: 0, y: 0, basis: "monotone" },
    { x: 0.5, y: 0.8, basis: "monotone" },
    { x: 1, y: 1, basis: "linear" },
  ],
};
evaluate(curve, 0.25);
```

The package ships unbuilt TypeScript (`src-ts/`); your bundler or `tsc` compiles it.

## Rust

```toml
[dependencies]
preset-math = { version = "0.1", features = ["serde"] }
```

```rust
use preset_math::{fit, Basis, Curve, CurvePoint};

let y = fit(0.3_f32, 0.0, 1.0, 10.0, 20.0);
let curve = Curve {
    points: vec![
        CurvePoint { x: 0.0, y: 0.0, basis: Basis::Monotone, tension: 0.0 },
        CurvePoint { x: 1.0, y: 1.0, basis: Basis::Linear, tension: 0.0 },
    ],
    sustain: None,
};
curve.evaluate(0.25);
```

No dependencies. The scalars take `f32` or `f64`; the curve is `f32` and never allocates while evaluating, so it is safe on an audio thread. The `serde` feature derives the same JSON shape as the TypeScript types.

## Notes

- **Curves:** points are sorted by x (`sortPoints` after an edit). Outside the points the end values hold. Two points at one x make a step, and the later one wins.
- **Monotone** is PCHIP (Fritsch–Carlson 1980, Fritsch–Butland 1984): smooth and never outside a segment's endpoints. **Catmull-Rom** may overshoot.
- **Envelopes:** `evaluateEnvelope(curve, t, release?)` holds at the sustain point until `release`, then plays the rest of the curve from the level it reached.
- **Bias and gain:** `bias`/`gain` are Schlick's (Graphics Gems IV, 1994), with no `pow`. `biasPerlin`/`gainPerlin` are Perlin's (SIGGRAPH 1985). They draw different curves for the same parameter.

## Development

Needs Rust (stable), Node 24 and pnpm, and [`just`](https://github.com/casey/just).

```sh
just install
just check      # cargo test, clippy, tsc and vitest
just fixtures   # regenerate fixtures/*.json from the TypeScript
```

`fixtures/*.json` are generated from the TypeScript and read by both test suites, so a change to either half that moves a number fails `just check`. Crate and npm package share one version.

## Licence

MIT
