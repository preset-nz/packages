# ux-kit: unbuilt TypeScript, plus a Tauri playground app in playground/.
# Standard verbs: install, dev, check.

default:
    @just --list

[group('setup')]
install:
    pnpm install

# Run the playground as a desktop app (Tauri shell).
[group('dev')]
dev:
    pnpm --dir playground tauri dev

# Typecheck and lint the kit.
[group('quality')]
check-kit:
    ./node_modules/.bin/tsc --noEmit
    ./node_modules/.bin/eslint .

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

# Kit and playground typecheck and lint, plus cargo check. The playground
# links the sibling packages, so this needs ~/rhizomatic-preset/packages/*.
[group('quality')]
check-all: check-kit check-playground check-rust
