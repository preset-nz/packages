#!/usr/bin/env bash
# Releases with knope (knope.toml).
#   scripts/release.sh [--dry-run]                 every package with releasable commits
#   scripts/release.sh [--dry-run] <pkg>           that package only
# knope has no flag for one package, so for one this swaps in a knope.toml that
# holds only that package's [packages.<pkg>] and the workflow, with the check
# and the commit message narrowed to it, and puts the original back afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

dry=()
pkg=
for a in "$@"; do
  case $a in
    --dry-run) dry=(--dry-run) ;;
    *) [ -z "$pkg" ] || { echo "release: one package at a time" >&2; exit 2; }; pkg=$a ;;
  esac
done

if [ -z "$pkg" ]; then exec knope release ${dry[@]+"${dry[@]}"}; fi

# A here-string, not a pipe: `grep -q` exits early, and pipefail would read the
# writer's SIGPIPE as a failure.
grep -qxF -- "$pkg" <<<"$(scripts/packages.sh)" \
  || { echo "release: no package '$pkg'; packages: $(scripts/packages.sh | tr '\n' ' ')" >&2; exit 2; }
git diff --quiet -- knope.toml \
  || { echo "release: knope.toml has uncommitted changes; commit them first" >&2; exit 1; }

backup=$(mktemp)
cp knope.toml "$backup"
trap 'cp "$backup" knope.toml; rm -f "$backup"' EXIT

# Keep [packages.<pkg>] and everything from the first [[workflows]] on.
awk -v pkg="$pkg" '
  /^\[\[workflows\]\]/ { wf = 1 }
  /^\[packages\./      { mine = ($0 == "[packages." pkg "]") }
  wf || (mine && !/^#/) { print }
' "$backup" \
  | sed -e "s/^command = \"just check\"$/command = \"just check $pkg\"/" \
        -e "s/release: packages/release: $pkg/" > knope.toml

knope release ${dry[@]+"${dry[@]}"}
