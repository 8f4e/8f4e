# Viewport Feature

Editor-state owns the logical viewport position and dimensions. Browser input plugins forward pointer, wheel, and
touch movement. Web-ui can present a transition without changing the logical viewport.

## State and coordinates

`state.viewport` contains pixel coordinates `x` and `y`, canvas dimensions `width` and `height`, and grid sizes
`vGrid` (column width) and `hGrid` (row height).

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
- `resize(state, width, height)` updates the canvas dimensions.
- The viewport effect handles `pointermove` and `resize`. Movement respects `viewportDragging`. Manual panning
  leaves the viewport at its final pixel position without aligning it to the grid.
- `centerViewportOnCodeBlock(viewport, block, options)` calculates a grid-aligned target with optional alignment.
  `centerViewportOnCodeBlockCursor` calculates a target centered on the highlighted source line.
- Directional navigation and jumping to a block commit the destination immediately. Any visual
  transition belongs to web-ui, not editor-state.
- Each project level remembers its viewport in browser memory. `getProjectViewportPosition` uses that remembered
  position or dispatches `resolveInitialProjectViewport { project, position }` for a first visit.
  Plugins may replace the default origin synchronously after block layout is settled. Project serializers omit
  remembered views.

## Rendering ownership

Web-ui owns visibility checks using presented block bounds and viewport dimensions. Offscreen arrow projection and
drawing belong to `@8f4e/editor-plugin-offscreen-block-arrows`, which uses the presented block coordinates.
Editor-state stores no border lines, cached center, or arrow presentation data.

## References

- Position updates: `updateViewport.ts`
- Dimensions: `resize.ts`
- Input effects: `effect.ts`
- Centering: `centerViewportOnCodeBlock.ts` and `centerViewportOnCodeBlockCursor.ts`
- Grid alignment for navigation targets: `roundToGrid.ts`
- Remembered views and initial placement: `getProjectViewportPosition.ts`
