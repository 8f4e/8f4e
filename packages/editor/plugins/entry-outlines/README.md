# Entry outlines

`entryOutlinesPlugin` draws borders and labels for `state.codeBlockRendering.entryBounds` below code blocks through
`registerCanvasBackgroundDrawer`. It translates world coordinates into the current viewport and owns border
thickness, label offsets, and palette selection. Every frame reads the current core bounds directly.

Editor-state owns entry membership, padded bounds, updates, and insertion hit testing. Creating a module inside
an entry assigns it to that entry; outside all bounds core allocates a fresh entry. Those semantics work without
this drawing plugin.

Both editor compositions load the plugin unconditionally through their deferred registries after `ready`.
Disposal unregisters its drawer. It creates no state subscriptions or input handlers and uses no browser APIs.

Run Nx `build`, `test`, `typecheck`, and `test:screenshot` for this package. Unit tests cover drawing from prepared
core bounds, current geometry/grid values, and drawer disposal. Browser screenshots use core and local block
fixtures for root/nested project views. Bounds and insertion tests live in editor-state; no sibling plugins are installed.
