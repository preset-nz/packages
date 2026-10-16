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

# The manifests of a package, without its playground.
manifests() {
  find "$1" -maxdepth 3 \( -name package.json -o -name Cargo.toml \) \
    -not -path '*/node_modules/*' -not -path '*/target/*' -not -path '*/playground/*'
}

if [ $# -eq 0 ]; then all; exit; fi

base=$1
changed=$(git diff --name-only "$(git merge-base "$base" HEAD)" -- ; git diff --name-only HEAD; git ls-files --others --exclude-standard)
# A root file (the workspaces, the lock, the toolchain) can change any package.
if printf '%s\n' "$changed" | grep -qv /; then all; exit; fi

hit=$(for p in $(all); do printf '%s\n' "$changed" | grep -q "^$p/" && echo "$p"; done)
dependants=$(for p in $hit; do
  for n in $(names "$p"); do
    for q in $(all); do
      [ "$q" = "$p" ] && continue
      manifests "$q" | xargs grep -lqE "\"$n\"|^$n *=" 2>/dev/null && echo "$q"
    done
  done
done)
printf '%s\n' $hit $dependants | sort -u | grep . || true
