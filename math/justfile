# Standard verbs: prep, install, run, check, build.
# A library with no runtime of its own, so `run` is absent. The npm package
# (src-ts/) ships unbuilt TypeScript, so `build` is absent too.

default:
    @just --list

[group('setup')]
install:
    cargo fetch
    pnpm install

# Both halves against the shared fixtures, plus lints and types.
[group('quality')]
check:
    cargo test --all-features
    cargo clippy --all-features --all-targets -- -D warnings
    ./node_modules/.bin/tsc --noEmit
    ./node_modules/.bin/vitest run

# Regenerate fixtures/*.json from the TypeScript reference. Review the diff:
# a moved value is a behaviour change, and Rust must follow it.
[group('quality')]
fixtures:
    node scripts/fixtures.ts
