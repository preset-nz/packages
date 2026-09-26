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
    cd playground && ./node_modules/.bin/wrangler deploy
