# Standard verbs: prep, install, run, check, build.
# `facets` is unbuilt source with no runtime of its own — `run` and `build`
# would have nothing to do, so they are deliberately absent.
#
# `check` typechecks src/ against the reference primitives in dev/ui/ — stand-ins
# typed to the shadcn API, NOT what any consumer ships. It is the fast signal;
# the authoritative one is that Oblique and Strata still compile against the
# real primitives. See dev/ui/README.md.

default:
    @just --list

[group('setup')]
install:
    pnpm install

[group('quality')]
check:
    ./node_modules/.bin/tsc --noEmit
    ./node_modules/.bin/biome check .
    node scripts/check-schema.ts
    just licences

# Writes the formatter's fixes (Biome).
[group('quality')]
fmt:
    ./node_modules/.bin/biome check --write .

# Licence check against the committed lock. Reads files only, no network.
# Re-resolve with `preset-compliance licences scan` after changing dependencies.
[group('quality')]
licences:
    preset-compliance licences check

# Playground dev server (facets.preset.nz), importing ../src directly
[group('dev')]
playground:
    pnpm --dir playground dev

[group('quality')]
playground-check:
    cd playground && ./node_modules/.bin/tsc --noEmit -p .

[group('build')]
playground-build:
    pnpm --dir playground build

# Outward-facing: publishes facets.preset.nz. Ask before running.
[group('build')]
playground-deploy: playground-build
    cd playground && pnpm dlx wrangler@4 deploy
