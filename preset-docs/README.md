# preset-docs

Documentation pages for the preset.nz apps, from what each app declares.

An app lists its nodes and their controls, with a label, a summary and a sentence on each. preset-docs turns that into one markdown page per node and an index. The table of controls sits between two markers and is rewritten on every run; everything a person writes around it is kept. A check fails when a page is missing, out of date or orphaned, so it can sit in an app's `just check`.

## Install

```toml
[dependencies]
preset-docs = { version = "0.1", features = ["rhizome"] }  # without the feature for a Catalogue of your own
```

The command line:

```sh
cargo install preset-docs
```

## Use

```rust
let catalogue = preset_docs::Catalogue::from(&registry.schema()); // feature "rhizome"
preset_docs::write(Path::new("docs/nodes"), &catalogue, "Shard")?;
let findings = preset_docs::check(Path::new("docs/nodes"), &catalogue, "Shard")?;
```

An app on [rhizome](https://github.com/preset-nz/packages/tree/main/rhizome) turns on the `rhizome` feature and hands over its schema. Any other app builds a `Catalogue`, or writes it as JSON for the command line:

```sh
preset-docs catalogue.json docs/nodes --app Oblique          # write
preset-docs catalogue.json docs/nodes --app Oblique --check  # fail if out of date
```

The JSON is the shape a rhizome schema dumps: `types`, each with `name`, `label`, `summary`, `group` and `values`.

### Settings

An app's settings come from its [preset-preferences](https://github.com/preset-nz/preferences) schema, dumped as JSON (a snapshot holding it under `schema` reads too):

```sh
preset-docs settings.json docs/settings --preferences --app Strata          # write
preset-docs settings.json docs/settings --preferences --app Strata --check  # fail if out of date
```

or in Rust, `preset_docs::preferences::read(&json)?` for the `Catalogue`. Each settings page becomes one page, led by the page's summary. Each section gets its own table under a `###` heading, advanced sections last and marked *(advanced)*. A preference's `help` is its row's sentence. The index is titled "<app> settings". A read-only path shows *set by the app*, never the machine's own path. A schema without pages gives one page, `settings.md`, with no summary, which `--check` fails: declare pages to document settings.

## A page

```markdown
---
title: Ladder
node: ladder
group: effect
summary: A driven four-pole low-pass after the patch filter.
---

# Ladder

<!-- generated:begin — preset-docs rewrites this block; write outside it -->
(the summary and the table of controls)
<!-- generated:end -->

## Using it

(written by hand)
```

A page can name a picture of its node under a `thumbnail` front-matter key, a path relative to the docs folder. preset-docs never writes that key and keeps it on every run; the index lists a group that has any as a table with a column of pictures. Bake the picture at the size it should show, since markdown can't size an image.

## Licence

MIT
