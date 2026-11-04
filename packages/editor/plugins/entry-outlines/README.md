# Entry outlines

`entryOutlinesPlugin` groups the current project level's module and project-group blocks by execution entry.
It owns padded bounds, entry labels, drawing, and spatial entry selection when a module is inserted.
Bounds stay private to each installation and refresh after layout, project, grid, and viewport changes.
The drawing callback uses these prepared bounds through `registerCanvasBackgroundDrawer`, below code blocks.

Core retains entry definitions, block membership, and execution semantics. Before inserting a module through
`createCodeBlock` or `insertCodeBlock`, it emits `resolveCodeBlockInsertionEntry { x, y, entry }` synchronously.
Coordinates are in world space; `entry` initially contains core's fresh entry name. The plugin replaces it with
the first outline containing that position, including its edges. Outside every outline, the default remains.
Without this plugin, module insertion uses core's default entry. Direct project-editing APIs and source batches
retain their explicit entry membership.

Both editor compositions load this plugin unconditionally through their deferred registries after `ready`.
Disposal removes drawing, insertion policy, listeners, and subscriptions. The plugin uses no browser APIs.

Run Nx `build`, `test`, `typecheck`, and `test:screenshot` for this package. Unit tests cover private geometry,
drawing, entry selection, refreshes, isolation, and disposal. A browser-free integration test covers insertion
through core's state machine. Browser screenshots use core and a local block fixture for root/nested project views.
Tests install no sibling presentation plugins.
