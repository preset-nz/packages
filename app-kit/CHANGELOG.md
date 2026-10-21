# Changelog

Releases up to 0.1.2 are described by their tags and commit messages.
## 0.1.4 (2026-10-21)

### Features

- models registry, download, verify, cancel and remove
- one models folder per machine, with manifests and users
- models commands and event, and an HTTPS client that works
- models subpath with useModelGate and ModelsSection

### Fixes

- export the models commands at the crate root
- require ux-kit 0.1.2, which the models screens import

## 0.1.3 (2026-10-13)

### Fixes

- allow finder_path to go unused off macOS
- start every launch on a fresh Untitled document
