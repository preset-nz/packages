# packages

The libraries behind the preset.nz desktop apps, in one repo. Each package keeps its own version, changelog and tags (`facets/v0.2.0`), and publishes on its own.

| Package | What it is | Published as |
|---|---|---|
| [`app-kit`](app-kit) | The behaviour of a desktop app: commands, the native menu, undo and redo, window restore | npm `@preset.nz/app-kit`, crate `preset-app-kit` |
| [`facets`](facets) | Inspector panels for React, defined as data | npm `@preset.nz/facets` |
| [`math`](math) | Value shaping in TypeScript and Rust, with the same results from both | npm `@preset.nz/math`, crate `preset-math` |
| [`preferences`](preferences) | Typed, versioned TOML preferences and a Cmd+, Settings window for Tauri apps | npm `@preset.nz/preferences`, crate `preset-preferences` |
| [`preset-docs`](preset-docs) | Documentation pages for an app's nodes, generated from what the app declares | crate `preset-docs` |
| [`rhizome`](rhizome) | The shared node API: a tree of typed nodes with undo, diff and a file format | crates `rhizome-core`, `rhizome-pom`, `rhizome-pom-tauri`; npm `@preset.nz/pom` |
| [`ux-kit`](ux-kit) | One look for the apps: tokens, palettes, fonts and Base UI primitives | npm `@preset.nz/ux-kit` |

How to use each one is in its own README.

## Build it

Prerequisites: [Node](https://nodejs.org), [pnpm](https://pnpm.io), [Rust](https://rustup.rs), [just](https://just.systems) and [preset-compliance](https://github.com/preset-nz/compliance) (`cargo binstall preset-compliance`). `just prep` lists what's missing.

```sh
just install           # pnpm, cargo and the git hooks
just check             # every package, then the licences
just check facets      # one package
just facets::<recipe>  # a package's own recipes
```

## Licence

[MIT](LICENSE).
