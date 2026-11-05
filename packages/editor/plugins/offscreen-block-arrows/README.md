# Offscreen block arrows

`offscreenBlockArrowsPlugin` draws viewport-edge arrows toward offscreen code blocks. It owns the projection from
the viewport center to the block's world position, glyph offsets, and palette selection. Drawing reads current raw
viewport dimensions and grid sizes; no arrow geometry is stored in editor-state.

Web-ui keeps its single block traversal and calls `registerOffscreenCodeBlockDrawer` for each offscreen block,
using world coordinates. This is one replaceable callback: later registrations win. Disposal clears the callback
only if the registration still owns it, without restoring earlier registrations. `canvasOverlays` suppresses
offscreen decorations during screenshot capture.

The default and minimal compositions load this plugin after `ready`. It uses no browser APIs or state subscriptions.

Verify with Nx `build`, `test`, `typecheck`, and `test:screenshot`. Tests cover directions, raw viewport edges,
panning/resizing, and disposal. Browser screenshots install only this plugin with core. The typecheck target covers both source and browser tests.
