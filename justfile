# preset-nz/packages. Standard verbs: prep, install, check. Every package also
# has its own justfile: `just <pkg>::<recipe>` from here (`just facets::playground`),
# or `just <recipe>` inside its folder. Libraries have no `run` or `build`.

mod app-kit
mod facets
mod math
mod preferences
mod preset-docs
mod rhizome
mod ux-kit

default:
    @just --list

# The tools the recipes call, and where to get the missing ones
[group('setup')]
prep:
    @echo "node:              $(node --version 2>/dev/null || echo MISSING)"
    @echo "pnpm:              $(pnpm --version 2>/dev/null || echo MISSING)"
    @echo "cargo:             $(cargo --version 2>/dev/null || echo MISSING)"
    @echo "preset-compliance: $(preset-compliance --version 2>/dev/null || echo 'MISSING (cargo binstall preset-compliance)')"
    @echo "knope:             $(knope --version 2>/dev/null || echo 'MISSING (cargo binstall knope)')"

# Every package's dependencies, one lock per ecosystem, and the git hooks
[group('setup')]
install:
    pnpm install
    cargo fetch
    ./node_modules/.bin/lefthook install

# Check the named packages, or all of them, then the licences
[group('quality')]
check *pkgs:
    #!/usr/bin/env bash
    set -euo pipefail
    for p in {{ if pkgs == "" { "$(scripts/packages.sh)" } else { pkgs } }}; do
      echo "── $p"
      just "$p::check"
    done
    just licences

# Check the packages changed since <base> and the packages that depend on them
[group('quality')]
check-changed base="origin/main":
    #!/usr/bin/env bash
    set -euo pipefail
    pkgs=$(scripts/packages.sh {{base}})
    if [ -z "$pkgs" ]; then echo "no package changed since {{base}}"; just licences; exit; fi
    just check $pkgs

# Apply every formatter in the named packages, or all of them
[group('quality')]
fmt *pkgs:
    #!/usr/bin/env bash
    set -euo pipefail
    for p in {{ if pkgs == "" { "$(scripts/packages.sh)" } else { pkgs } }}; do just "$p::fmt"; done

# Licence check against the committed lock. Reads files only, no network.
[group('quality')]
licences:
    preset-compliance licences check

# Re-resolve the licence lock after a dependency change
[group('quality')]
licences-scan:
    preset-compliance licences scan

# Version, changelog, commit and a scoped tag (knope.toml): `just release facets`
# for one package, `just release` for every package with releasable commits
# since its last tag. Push and publish stay by hand.
[group('build')]
release *pkg:
    scripts/release.sh {{pkg}}

# What `release` would do, without touching anything
[group('build')]
release-preview *pkg:
    scripts/release.sh --dry-run {{pkg}}

# Publish a released package from its tag: crates, npm, GitHub release. Run it
# yourself (2FA); `--dry-run` stops short of uploading
[group('build')]
publish pkg *flags:
    scripts/publish.sh {{pkg}} {{flags}}
