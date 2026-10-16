# ux-kit: unbuilt TypeScript, plus a Tauri playground app in playground/.
# Standard verbs: install, dev, check, fmt, licences, release.

default:
    @just --list

[group('setup')]
install:
    pnpm install
    ./node_modules/.bin/lefthook install

# Run the playground as a desktop app (Tauri shell).
[group('dev')]
dev:
    pnpm --dir playground tauri dev

# Typecheck, Biome (lint and format check).
[group('quality')]
check-kit:
    ./node_modules/.bin/tsc --noEmit
    ./node_modules/.bin/biome check .

# Typecheck the playground (it also typechecks the kit source it imports).
[group('quality')]
check-playground:
    cd playground && ./node_modules/.bin/tsc --noEmit -p .

# cargo check for the playground's Rust side. tauri's context macro wants
# frontendDist to exist, so make an empty one first.
[group('quality')]
check-rust:
    mkdir -p playground/dist
    cd playground/src-tauri && cargo check

# The kit alone: passes from a clean clone.
[group('quality')]
check: check-kit
    just licences

# Writes the formatters' fixes (Biome).
[group('quality')]
fmt:
    ./node_modules/.bin/biome check --write .

# Kit and playground typecheck and lint, plus cargo check. The playground
# links the sibling packages, so this needs ~/rhizomatic-preset/packages/*.
[group('quality')]
check-all: check-kit check-playground check-rust

# Licence check against the committed lock. Reads files only, no network.
# Re-resolve with `preset-compliance licences scan` after changing dependencies.
[group('quality')]
licences:
    preset-compliance licences check

# Version, changelog, commit and tag from the conventional commits since the last
# tag (knope.toml). Push and publish stay by hand: guidance runbooks/publish-npm-package.md.
[group('build')]
release:
    knope release

# What `release` would do, without touching anything.
[group('build')]
release-preview:
    knope release --dry-run
