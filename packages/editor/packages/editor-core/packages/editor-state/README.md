# Editor State Package

This package implements a platform-agnostic editor state machine. It owns the full application state shape and the logic that updates that state in response to internal events, without depending on platform specific APIs.

## Execution entries

Core owns entry definitions and module/project-group membership at each project level. Before inserting a module
through `createCodeBlock` or `insertCodeBlock`, it emits `resolveCodeBlockInsertionEntry { x, y, entry }` with world
coordinates and a fresh default entry name. Plugins may replace `entry` synchronously before insertion.

`@8f4e/editor-plugin-entry-outlines` owns padded entry bounds, labels, drawing, and selecting a containing entry
for module insertion. Core keeps no outline geometry. Without that plugin, insertion uses the default entry.
