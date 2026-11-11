# Changelog

Releases up to 0.1.1 are described by their tags and commit messages.
## 0.2.0 (2026-11-11)

### Breaking Changes

- settings pages and advanced sections
- SettingsWindow takes onClose and persistKey only: open, onOpenChange, title, onOverlay and icons are gone, and it fills its window instead of drawing a modal, so an app opens Settings in its own window (Cmd+,) and renders it there; the peer range is now facets ^0.3.0.

### Features

- Settings tabs on ux-kit's Tabs
- Settings fills its own window, on facets' pages
- each preference's help sits under it
- extraGroups for sections the crate doesn't own

## 0.1.2 (2026-10-08)

### Fixes

#### Accept @preset.nz/facets 0.2 as a peer

The peer range is now `^0.1.0 || ^0.2.0`, so apps on facets 0.2 install without an `overrides` entry.
