# Viewport Feature

Editor-state owns viewport position, dimensions, grid snapping, and animation targets. Browser input plugins
forward pointer, wheel, and touch movement; core updates the viewport before web-ui draws each frame.

## State and coordinates

`state.viewport` contains pixel coordinates `x` and `y`, raw canvas dimensions `width` and `height`, grid sizes
`vGrid` (column width) and `hGrid` (row height), and grid-rounded dimensions `roundedWidth` and `roundedHeight`.
`state.viewportAnimation` contains the current pan's start, target, and timing data.

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

- `updateViewport(state, x, y, events)` commits a rounded position and emits `viewportChanged` only when it changes.
- `resize(state, width, height)` updates raw and grid-rounded dimensions. The resize handler emits `viewportResized`.
- The viewport effect handles `pointermove`, `pointerup`, `resize`, and `viewportscrollend`. Movement respects
  `viewportDragging`; release and scroll-end handlers snap the final position to the grid.
- `centerViewportOnCodeBlock(viewport, block, options)` calculates a grid-aligned target with optional alignment.
  `centerViewportOnCodeBlockCursor` calculates a target centered on the highlighted source line.
- `animateViewport` sets a pan target. Editor-core calls `advanceViewportAnimation` before each scheduled or
  on-demand render; `stopViewportAnimation` cancels an active pan. Editor-state owns no frame scheduler.
- Each project level remembers its viewport in browser memory. `getProjectViewportPosition` uses that remembered
  position, then the first home block's placement, or the origin. Project serializers omit remembered views.

## Rendering ownership

Web-ui owns visibility checks using block bounds and raw viewport dimensions. Offscreen arrow projection and
drawing belong to `@8f4e/editor-plugin-offscreen-block-arrows`, which reads the current viewport directly.
Editor-state stores no border lines, cached center, or arrow presentation data.

## References

- Position updates: `updateViewport.ts`
- Dimensions: `resize.ts`
- Input effects: `effect.ts`
- Animation: `animateViewport.ts`
- Centering: `centerViewportOnCodeBlock.ts` and `centerViewportOnCodeBlockCursor.ts`
- Grid snapping: `snapToGrid.ts`, `snapToGridConsideringDirection.ts`, and `roundToGrid.ts`
- Remembered views and home placement: `getProjectViewportPosition.ts`
