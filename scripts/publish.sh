#!/usr/bin/env bash
# Publishes one package at its release tag: its crates to crates.io, then its npm
# package, then the GitHub release. Run it in your own terminal: both registries
# ask for 2FA.
#   scripts/publish.sh <pkg>            publish
#   scripts/publish.sh <pkg> --dry-run  everything but the upload
# It refuses unless the package's newest tag (`just release <pkg>` makes it) is
# on GitHub and in this branch, its folder is unchanged since, and the tree is
# clean: a registry never gets a version that differs from a public commit.
set -euo pipefail
cd "$(dirname "$0")/.."

pkg=${1:-}
dry=()
[ "${2:-}" = "--dry-run" ] && dry=(--dry-run)
[ -n "$pkg" ] || { echo "usage: just publish <pkg> [--dry-run]" >&2; exit 2; }
# A here-string, not a pipe: `grep -q` exits early, and pipefail would read the
# writer's SIGPIPE as a failure.
grep -qxF -- "$pkg" <<<"$(scripts/packages.sh)" \
  || { echo "publish: no package '$pkg'; packages: $(scripts/packages.sh | tr '\n' ' ')" >&2; exit 2; }

tag=$(git tag -l "$pkg/v*" --sort=-v:refname | head -1)
[ -n "$tag" ] || { echo "publish: $pkg has no release tag; run just release $pkg" >&2; exit 1; }
git merge-base --is-ancestor "$tag" HEAD \
  || { echo "publish: $tag isn't in this branch's history" >&2; exit 1; }
# The playground isn't published, and another package's release bumps its lockfile.
git diff --quiet "$tag" HEAD -- "$pkg" ":(exclude)$pkg/playground" \
  || { echo "publish: $pkg/ changed since $tag; release it again (just release $pkg)" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "publish: the working tree isn't clean" >&2; exit 1; }
git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null \
  || { echo "publish: $tag isn't on GitHub; git push origin main --follow-tags" >&2; exit 1; }

# The package's crates: workspace members whose manifest sits under its folder.
crates=$(cargo metadata --no-deps --format-version 1 | python3 -c '
import json, os, sys
root, pkg = os.getcwd(), sys.argv[1]
for p in json.load(sys.stdin)["packages"]:
    rel = os.path.relpath(p["manifest_path"], root)
    if rel.startswith(pkg + "/") and p.get("publish") != []:
        print(p["name"])' "$pkg")

echo "publish: $tag"
if [ -n "$crates" ]; then
  args=()
  for c in $crates; do args+=(-p "$c"); done
  echo "crates.io: $crates"
  cargo publish "${args[@]}" ${dry[@]+"${dry[@]}"}
fi
if [ -f "$pkg/package.json" ]; then
  echo "npm: $(sed -n 's/^  "name": "\(.*\)",$/\1/p' "$pkg/package.json")"
  (cd "$pkg" && pnpm publish ${dry[@]+"${dry[@]}"})
fi
if [ ${#dry[@]} -eq 0 ]; then
  gh release create "$tag" --repo preset-nz/packages --generate-notes
else
  echo "would run: gh release create $tag --repo preset-nz/packages --generate-notes"
fi
