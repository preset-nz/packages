# Changelog

Releases up to 0.1.2 are described by their tags and commit messages.
## 0.1.5 (2026-11-01)

### Features

- add pick, recent paths, reveal and exists for path fields
- add a native Reveal in Finder and Clear menu for paths
- route Finder file drops to the path field under them
- ToolbarFlyout puts several tools behind one button

### Fixes

- keep ampersands in menu text
- a document opened by launching the app opens
- peer on ux-kit 0.1.3, which has the tool flyout's fields

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
