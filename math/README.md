# math

Value shaping for the preset.nz desktop apps, in TypeScript and Rust with the same results in both.

- **Scalars:** `lerp`, `invlerp`, `clamp`, `fit`, `fitUnclamped`, `smooth`, `bias`, `gain`, `biasPerlin`, `gainPerlin`.
- **Curve:** points with a basis each (constant, linear, monotone, Catmull-Rom), tension on linear segments, and a sustain point for envelopes. `evaluate`, `evaluateEnvelope`, `bake` and `evaluateBaked`.

npm `@preset.nz/math` ships unbuilt TypeScript (`src-ts/`). The crate `preset-math` (`src/`) has no dependencies; enable `serde` for the curve's derives. One version covers both.

`fixtures/*.json` are generated from the TypeScript (`just fixtures`) and read by both test suites, so a change to either half that moves a number fails `just check`.

Design notes: `guidance/design/math.md`. MIT.
