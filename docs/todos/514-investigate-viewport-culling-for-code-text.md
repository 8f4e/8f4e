---
title: 'TODO: Investigate viewport culling for code text'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
---

# TODO: Investigate viewport culling for code text

## Problem Description

The editor skips code blocks that are entirely outside the viewport. Once a block intersects the viewport, however,
the code-block drawer visits every projected text row and submits every nonempty cell in those rows. A tall or wide
block can therefore submit many glyphs whose destination rectangles lie entirely outside the canvas.

GPU clipping prevents those glyphs from producing visible pixels, but their CPU traversal, instance-buffer writes,
uploads, and vertex processing still take place. Investigate calculating visible text row and column ranges before
submission so large, partially visible blocks do work proportional to their visible text.

## Proposed Investigation

- Start with projected code text drawn through `DrawContext.drawResolvedText()`. Keep existing whole-block culling,
  widget drawing, overlays, and painter order intact.
- Derive the viewport rectangle in each block's local drawing coordinates, including viewport translation, block
  placement, text origin, and the active font's cell dimensions.
- Calculate bounded row and column ranges that include every partially visible glyph and exclude fully off-screen
  glyphs. Preserve original cell positions when skipping leading rows or columns.
- Use the final projected rows, which already contain prefixes, tab expansion, folded-line placeholders, and inserted
  gaps. Source-line indices are not interchangeable with these display-row indices.
- Compare a caller-owned visible range with a range-aware text submission method and choose the simpler ownership
  boundary. Avoid scanning hidden rows or allocating sliced cell arrays on each frame.
- Leave projection generation and its cache invalidation unchanged during this investigation. The full projected
  text can remain cached independently of the current viewport.

Recording this TODO does not implement culling. The outcome should identify a concrete implementation approach,
verify rendering equivalence, and measure its benefit and overhead.

## Implementation Plan

### Step 1: Audit coordinates and define the range contract

- Trace the final text rectangles through nested drawing groups, viewport scrolling, block dragging, and resizing.
- Account for the one-cell horizontal text inset and the existing `vGrid` width / `hGrid` height convention.
- Define half-open row and column ranges, their clamping to actual row lengths, and exact viewport-edge behavior.
- Recompute visibility from current viewport and font metrics; avoid stale ranges after font changes or movement.
- Consider a simple fast path for fully visible text if range calculation adds measurable overhead.

### Step 2: Validate a contained prototype

- Compare submitted glyph IDs, colors, and positions with the baseline for fully visible blocks.
- Cover each viewport edge, exact cell boundaries, one-pixel intersections, negative block positions, and fractional
  translations where supported. Partially visible glyphs must retain their original rectangles for GPU clipping.
- Exercise very long lines, tall blocks, empty rows, trailing spaces, null cells, line-number prefixes, tabs, folded
  rows, and widget gaps without collapsing character advances or changing the displayed row mapping.
- Verify scrolling, dragging, canvas resizing, and all supported font dimensions through rendering fixtures.
- Keep caret, selection, connectors, widgets, and plugin overlays visible and ordered exactly as before. This work
  must not introduce a new clip to code-block bounds where the existing renderer allows content to extend beyond them.

### Step 3: Measure submission savings and rendering time

- Compare identical scenes before and after culling with a fixed viewport: a tall block, a wide block, many fully
  visible small blocks, and representative editor content.
- Vary the amount of off-screen text while holding visible content constant. Confirm hidden rows and columns are
  skipped without traversing the complete text just to select visible cells.
- Record visited cells, submitted sprite counts, uploaded instance bytes, CPU submission time, and GPU time separately.
- Warm up both variants, repeat measurements, and report timing precision, browser, GPU, and hardware. Do not treat
  fewer uploaded instances as proof of a specific frame-time improvement.
- Keep shaders, palette storage, instance format, visible content, and draw-call count equivalent. Evaluate this
  independently of fixed-grid glyph addressing, integer instance packing, and broader text caching changes.

## Success Criteria

- [ ] Coordinate ownership and visible-range calculations are documented for projected code text.
- [ ] Fully off-screen cells are omitted while partially visible cells retain their positions and appearance.
- [ ] Layout, interaction, and browser checks cover boundaries, scrolling, dragging, fonts, tabs, folds, and gaps.
- [ ] Measurements distinguish traversal and upload savings from CPU/GPU timing, including fully visible workloads.
- [ ] A recommendation records the preferred implementation boundary, measured tradeoffs, and follow-up scope.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/src/drawers/codeBlocks/index.ts` - Text row submission.
- `packages/editor/packages/editor-core/packages/web-ui/src/drawContext.ts` - Resolved cell submission and positioning.
- `packages/editor/packages/editor-core/packages/web-ui/packages/render-projection/src/deriveCodeBlockCodeCells.ts` -
  Existing display-row, prefix, tab, and gap contracts to preserve.
- Code-block drawer tests, draw-context tests, browser fixtures, and benchmark tooling.

## Related Items

- [TODO 510: Use glyph masks and a GPU color palette](archived/510-use-glyph-masks-and-gpu-color-palette.md) - Current
  rendering design and recorded measurements.
- [TODO 512: Investigate integer sprite instance packing](512-investigate-integer-sprite-instance-packing.md) - Separate
  optimization of bytes per submitted sprite.
- [TODO 513: Benchmark fixed-grid glyph addressing](513-benchmark-fixed-grid-glyph-addressing.md) - Separate shader
  addressing experiment; hold that behavior constant when measuring culling.

## Archive Instructions

When the investigation is complete, record the recommendation, set `status: Completed` and the completion date,
move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
