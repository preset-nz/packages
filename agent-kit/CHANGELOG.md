# Changelog
## 0.2.1 (2026-11-12)

### Features

- default to oMLX; errors name the server address

## 0.2.0 (2026-11-11)

### Breaking Changes

- Model::resolve and pick_model return Chosen { id, load }, and Ask has a load field.

### Features

- add the model client and tool loop, lifted from Shard
- an optional API key, oMLX, and the phase of a reply
