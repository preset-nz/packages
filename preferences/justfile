# Standard verbs: prep, install, run, check, build.
# The crate has no runtime of its own, so `run` is absent. The npm package
# (src-ts/) ships unbuilt TypeScript, so `build` is absent too.

default:
    @just --list

[group('setup')]
install:
    cargo fetch

[group('quality')]
check:
    cargo check --all-features
    cargo test --all-features
    cargo clippy --all-features -- -D warnings
