# preset-docs

Documentation pages for the preset.nz apps, from what each app declares.

An app lists its nodes and their controls, with a label, a summary and a sentence on each. preset-docs turns that into one markdown page per node and an index. The table of controls sits between two markers and is rewritten on every run; everything a person writes around it is kept. A check fails when a page is missing, out of date or orphaned, so it can sit in an app's `just check`.

## Use

```rust
let catalogue = preset_docs::Catalogue::from(&registry.schema()); // feature "rhizome"
preset_docs::write(Path::new("docs/nodes"), &catalogue, "Shard")?;
let findings = preset_docs::check(Path::new("docs/nodes"), &catalogue, "Shard")?;
```

An app on [rhizome](https://github.com/preset-nz/rhizome) turns on the `rhizome` feature and hands over its schema. Any other app builds a `Catalogue`, or writes it as JSON for the command line:

```sh
preset-docs catalogue.json docs/nodes --app Oblique          # write
preset-docs catalogue.json docs/nodes --app Oblique --check  # fail if out of date
```

The JSON is the shape a rhizome schema dumps: `types`, each with `name`, `label`, `summary`, `group` and `values`.

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

## Licence

MIT
