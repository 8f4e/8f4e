# Viewport Feature

Editor-state owns the logical viewport position and dimensions. Browser input plugins forward pointer, wheel, and
touch movement. Web-ui can present a transition without changing the logical viewport.

## State and coordinates

`state.viewport` contains pixel coordinates `x` and `y`, canvas dimensions `width` and `height`, and grid sizes
`vGrid` (column width) and `hGrid` (row height).

Grid dimensions start at zero, without assuming a font's cell size. Source loading, configuration resolution, and
compilation may proceed immediately; pixel layout waits for positive grid dimensions. The renderer supplies its grid
dimensions through `setGridSize` when they are known.

`markGridSizePending(state)` marks the requested grid unavailable (`state.gridSizeReady = false`) while keeping
the previously installed dimensions usable for layout and drawing. `setGridSize(state, events, size)` installs the
positive dimensions and dispatches `gridSizeChanged` when they differ, settling layout synchronously. It then calls
`settleGridSize(state, events)` to mark `state.gridSizeReady` true and resolve any pending first-visit placement.
When a pending replacement is canceled or fails, the renderer calls `settleGridSize` directly on the still-installed
positive grid, without changing its dimensions or invalidating layout. A newly installed font may also use the same
dimensions. Ordinary font changes do not reposition an already placed viewport.

Block positions use world coordinates. Canvas coordinates are relative to the canvas's top-left corner; convert
between them with the viewport offset:

```text
worldX = canvasX + viewport.x
worldY = canvasY + viewport.y
canvasX = worldX - viewport.x
canvasY = worldY - viewport.y
gridX = Math.round(worldX / viewport.vGrid)
gridY = Math.round(worldY / viewport.hGrid)
```

Source positions use grid units. Live viewport and block geometry use pixels. Grid conversion can lose sub-grid
precision; viewport updates round to whole pixels. Zoom is not implemented.

## Updates and navigation

- `updateViewport(state, x, y, events, source?)` commits a rounded position and emits `viewportChanged` only when it
  changes. The optional source distinguishes manual panning (`pan`) from navigation to a block or home (`navigation`).
  Either takes precedence over a pending first visit.
- `resize(state, width, height)` updates the canvas dimensions.
- The viewport effect handles unconsumed `pointermove` and `resize` events. Manual panning
  leaves the viewport at its final pixel position without aligning it to the grid.
- `centerViewportOnCodeBlock(viewport, block, options)` calculates a grid-aligned target with optional alignment.
  `centerViewportOnCodeBlockCursor` calculates a target centered on the highlighted source line.
- Directional navigation and jumping to a block commit the destination immediately. Any visual
  transition belongs to web-ui, not editor-state.
- Each project level remembers its viewport in browser memory. Group navigation follows actual owning blocks rather than
  name-based compiler paths and places the destination immediately;
  project restoration requests placement once after synchronous project-change subscribers settle. Remembered positions
  take precedence; first-visit placement waits while the selected grid is pending. Once layout has settled, core dispatches
  `resolveInitialProjectViewport { level, position }`, allowing plugins to replace the default origin synchronously.
  Leaving a level before this happens does not remember the temporary origin. Project serializers omit remembered views.

## Rendering ownership

Web-ui owns visibility checks using presented block bounds and viewport dimensions. Offscreen arrow projection and
drawing belong to `@8f4e/editor-plugin-offscreen-block-arrows`, which uses the presented block coordinates.
Editor-state stores no border lines, cached center, or arrow presentation data.

## References

- Position updates: `updateViewport.ts`
- Dimensions: `resize.ts`
- Input effects: `panAndResize.ts`
- Centering: `centerViewportOnCodeBlock.ts` and `centerViewportOnCodeBlockCursor.ts`
- Grid alignment for navigation targets: `roundToGrid.ts`
- Grid availability and updates: `gridSize.ts`
- Remembered views and initial placement: `updateViewport.ts` and `getProjectViewportPosition.ts`
