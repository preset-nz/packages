# packages/ — shared libraries for the preset.nz apps

`packages/` is one git repo, the `preset-nz/packages` monorepo (since 2026-10-16). Each package directly under it keeps its own version, changelog, registry names and scoped tags (`facets/v0.2.0`). The root owns the tooling: one pnpm and one Cargo workspace, `knope.toml`, `lefthook.yml`, CI and the licence lock. `just check [<pkg>…]` and `just check-changed` run from the root; each package's own recipes are `just <pkg>::<recipe>`. It is public on GitHub since 2026-10-17, and the old per-package repos are frozen: don't commit or push to them.

**Working here:** roadmaps stay per package (each package's guidance project), handovers go in `handovers/packages/handover-<pkg>.md`, and a session may start in a package folder, with the catches in [`projects/packages`, Working in the monorepo](../guidance/projects/packages/README.md#working-in-the-monorepo).

Versions released, pending and the apps behind: [`runbooks/pending-releases.md`](../guidance/runbooks/pending-releases.md) (owner), the registries and the scoped git tags are the truth. This table says only what exists and where it publishes. The Repo column is the package's old repo, which the published versions still link to until epic 03 of the monorepo project.

| Package | Repo | Registries | Notes |
|---|---|---|---|
| `facets/` | `preset-nz/facets` | npm `@preset.nz/facets` | 0.2 needs the host's NumberField, Slider and ColorField, so apps take it with ux-kit. preferences (peer) |
| `preferences/` | `preset-nz/preferences` | npm `@preset.nz/preferences` + crates.io `preset-preferences`, lockstep | |
| `rhizome/` | `preset-nz/rhizome` | crates.io `rhizome-core`, `rhizome-pom`, `rhizome-pom-tauri`; npm `@preset.nz/pom` | knope versions the workspace together |
| `preset-docs/` | `preset-nz/preset-docs` (private; public at its first publish) | none yet: crates.io `preset-docs` | Oblique (`docs/gen`) and Shard take it by path, `rhizome` feature. Moved out of rhizome 2026-10-14 ([`projects/preset-docs`](../guidance/projects/preset-docs/README.md)) |
| `ux-kit/` | `preset-nz/ux-kit` | npm `@preset.nz/ux-kit` | its own `playground/` (Tauri, by link; `just check-all`) |
| `app-kit/` | `preset-nz/app-kit` | npm `@preset.nz/app-kit` + crate `preset-app-kit`, lockstep | ux-kit playground by path + link |
| `math/` | `preset-nz/math` | npm `@preset.nz/math` + crate `preset-math`, lockstep | [`design/math.md`](../guidance/design/math.md) |
| `paths/` | not created yet: `preset-nz/paths` | none yet: npm `@preset.nz/paths` + crate `preset-paths`, lockstep | Proposed 2026-10-06 ([`design/paths.md`](../guidance/design/paths.md)) |
| `app-folders/` | not created yet | none | Proposed 2026-09-27 ([`design/app-folders.md`](../guidance/design/app-folders.md)). Feeds app-kit's `documents_folder` hook from the app, not by dependency |

**Every library package is public, MIT and published** (Georg, 2026-10-06, [`family-alignment.md`](../guidance/design/family-alignment.md#going-public)). Exceptions: preset-docs goes public at its first publish, and create-preset-app is private. Apps may commit a path dependency on a package (`link:` or `[patch]`) and take a registry version when one is cut (Georg, 2026-10-12, reversing registry-only). Stay on 0.x. Issues, projects and wiki off. The ux-kit playground is the one place that links siblings, as the workspace harness.

**Publish when an app needs it** (Georg, 2026-10-06). A package changes freely in the playground, committed and pushed as often as you like (push needs no asking: [`~/.claude/CLAUDE.md`](~/.claude/CLAUDE.md)). A release happens when an app's work needs the change on the registry, and it takes everything that has built up since the last one. Pushing is cheap; a publish costs 2FA and npm's validation wait, so it isn't done per feature.

**One monorepo, `preset-nz/packages`, rooted at this folder** (Georg, 2026-10-15): [`projects/packages`](../guidance/projects/packages/README.md). A new package is a folder here, not a repo. compliance and create-preset-app aren't packages here: they are their own repos in `~/rhizomatic-preset/tools/` (Georg, 2026-10-16).

**Where shared code lives is decided per case**, not by a second consumer: [family-alignment rule 6](../guidance/design/family-alignment.md#rules).

**Dependency direction** between the packages, with a diagram: [`design/desktop-family-stack.md#dependencies`](../guidance/design/desktop-family-stack.md#dependencies). It owns it; don't restate it here. ux-kit is the look, app-kit the behaviour (commands, menu sync, undo titles, text-field undo, selection, window restore). Lockstep crate and npm versions: preferences, math, app-kit, paths.

## Where the thinking lives

Planning docs live in the guidance repo, not here.

- `~/rhizomatic-preset/guidance/design/facets.md` — what facets is, what may live inside it, the parked ladder towards the v2 DSL.
- `~/rhizomatic-preset/guidance/projects/preferences/README.md` — preferences project index, locked decisions, epics.
- `~/rhizomatic-preset/guidance/design/node-api.md` and `design/rhizome-api.md` — rhizome's model and API; `projects/rhizome/README.md` its index.
- `~/rhizomatic-preset/guidance/design/tauri-scaffold.md` — the package family preferences is the first of.
- `~/rhizomatic-preset/guidance/design/family-alignment.md` — **the order the apps move onto rhizome, ux-kit and app-kit**, the rules (one migration in flight; done = old system deleted) and the per-app status matrix. Update it when a migration lands.
- `~/rhizomatic-preset/guidance/runbooks/publish-npm-package.md` — **the release procedure.** Follow it; fix it when it's wrong.
- `~/rhizomatic-preset/guidance/runbooks/package-release-qa.md` — **the QA pass** before a release or a consumer switch. The working tree lies: verify in a clean room and inspect the built output.
- `~/rhizomatic-preset/guidance/runbooks/project-visibility-and-licensing.md` — the five-clause gate for going public.
- `~/rhizomatic-preset/guidance/handovers/<package>/handover.md` — session state.

## Conventions

- **Ship source, not builds.** npm packages export unbuilt TypeScript (`exports` → `src*/index.ts`) and the consumer's Vite/tsc compiles it. Verified by tarball install into a fresh Oblique clone. Adding a `dist/` is a deliberate decision, not a patch.
- **`just check` in the package is the fast signal. The consumers are the real one.** Before a release, run `just check` in every consumer against the working copy (consumer list: [`package-adoption-audit.md`](../guidance/runbooks/package-adoption-audit.md)).
- **Pre-1.0 versioning:** breaking → minor (`0.1.x → 0.2.0`), anything else → patch. Consumers pin `^0.x.y`.
- **Lockstep packages (preferences, math, app-kit) keep crate and npm versions together.** One `vX.Y.Z` tag covers both halves; preferences' TS types mirror the serde shape by hand. Versions are bumped by `just release`, never by hand or `sed` ([`publish-npm-package.md`](../guidance/runbooks/publish-npm-package.md), step 3).
- **Peer dependencies stay peers.** React, `@tauri-apps/api`, facets, and the shadcn primitives (resolved through the consumer's `@/components/ui/*` alias; `dev/ui/` holds typed stand-ins for local typechecks only).
- **Consumers need** `resolve.dedupe: ["react", "react-dom", "@tauri-apps/api", "@preset.nz/facets"]` in Vite, and a Tailwind `@source "../node_modules/@preset.nz/<pkg>/<src dir>"` per package (the renderers' layout classes live in the package source, and Tailwind 4 doesn't scan `node_modules`). Missing it fails silently: the build passes, the panel renders unstyled, `just check` stays green. See each package's README.
- **A committed link is fine** in a consumer (Georg, 2026-10-12). Use `"link:../../packages/<pkg>"` in `package.json` (every app is on pnpm) and `[patch.crates-io] <crate> = { path = "../../packages/<pkg>/…" }` for the crate, and name the app in the package's `pending-releases.md` row. A clean clone and CI need the sibling checkouts until the app is back on versions.
- MIT everywhere. User-facing strings in NZ English.

## Irreversible steps — always ask first

Flipping a repo public, `pnpm publish`, and `cargo publish`. A plain push needs no asking ([`~/.claude/CLAUDE.md`](~/.claude/CLAUDE.md), "Push without asking"). A published version number is burned forever on both registries: npm allows unpublish only within 72 hours, and crates.io only yanks. Fix forward with a patch and deprecate or yank the bad version.

## Gotchas

- Bash cwd resets between calls. Use absolute paths, or `just <pkg>::<recipe>` from the root.
- Two GitHub profiles. Default is `rhizomatic-preset`: SSH host `github.com` (`id_ed25519`) and the active `gh` account, which is what the `preset-nz` remotes use. Occasionally `rdg`: SSH host alias `github-rdg` (`id_ecdsa`), `gh auth switch --user rdg`. "Repository not found" on push means the remote and the `gh` account point at different users.
- `pnpm pack` succeeds on a `private: true` package; only `publish` refuses. Test publishability by installing the tarball into a fresh consumer clone, never from the working tree (which resolves through siblings).
- facets' `sideEffects: false` is only safe because built-in renderers register via an explicit `registerBuiltinRenderers()` call.
