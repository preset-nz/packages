# Standard verbs: prep, install, run, check, build.
# The crate has no runtime of its own, so `run` is absent. The npm package
# (src-ts/) ships unbuilt TypeScript, so `build` is absent too.

default:
    @just --list

[group('setup')]
install:
    cargo fetch
    pnpm install

[group('quality')]
check:
    cargo check --all-features
    cargo test --all-features
    cargo clippy --all-features -- -D warnings
    ./node_modules/.bin/tsc --noEmit
