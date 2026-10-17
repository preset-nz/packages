#!/usr/bin/env bash
# Lists the packages: every top-level folder with its own justfile.
#   scripts/packages.sh            all packages
#   scripts/packages.sh <base>     packages with files changed since <base>, plus
#                                  the packages whose manifests name them
set -euo pipefail
cd "$(dirname "$0")/.."

all() { for f in */justfile; do dirname "$f"; done; }

# The names a package publishes under: npm name, crate names.
names() {
  { [ -f "$1/package.json" ] && sed -n 's/^  "name": "\(.*\)",$/\1/p' "$1/package.json"
    find "$1" -maxdepth 3 -name Cargo.toml -not -path '*/node_modules/*' -not -path '*/target/*' -not -path '*/playground/*' \
      -exec sed -n 's/^name = "\(.*\)"$/\1/p' {} +; } | sort -u
}

# The manifests of a package, its playground's included: a playground that
# links a sibling breaks when that sibling changes (the ux-kit playground on
# preferences' settings pages, 2026-10-17), so the package re-checks.
manifests() {
  find "$1" -maxdepth 4 \( -name package.json -o -name Cargo.toml \) \
    -not -path '*/node_modules/*' -not -path '*/target/*'
}

if [ $# -eq 0 ]; then all; exit; fi

base=$1
# No such ref (no remote yet, a fresh clone): everything.
git rev-parse --verify -q "$base^{commit}" >/dev/null || { all; exit; }
changed=$({ git diff --name-only "$(git merge-base "$base" HEAD)"; git ls-files --others --exclude-standard; } | sort -u)
[ -z "$changed" ] && exit 0
# A root file (the workspaces, the lock, the toolchain) can change any package.
# Here-strings, not pipes: `grep -q` exits early, and pipefail would read the
# writer's SIGPIPE as a failure.
if grep -qv / <<<"$changed"; then all; exit; fi

hit=$(for p in $(all); do if grep -q "^$p/" <<<"$changed"; then echo "$p"; fi; done)
dependants=$(for p in $hit; do
  for n in $(names "$p"); do
    for q in $(all); do
      [ "$q" = "$p" ] && continue
      if manifests "$q" | xargs grep -lE "\"$n\"|^$n *=" >/dev/null 2>&1; then echo "$q"; fi
    done
  done
done)
printf '%s\n' $hit $dependants | sort -u | grep . || true
