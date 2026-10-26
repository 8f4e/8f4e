---
title: 'TODO: Investigate integer sprite instance packing'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
---

# TODO: Investigate integer sprite instance packing

## Problem Description

`glugglugglug` uploads 20 bytes per sprite: four float32 values for destination position and size, followed by a
uint16 sprite ID and a uint16 palette index. 8f4e generally draws at whole-pixel coordinates, so fractional precision
may be unnecessary for its sprite submissions. Verify that assumption across drawers and plugins before changing
the renderer contract.

Using 16-bit rectangle fields could reduce each instance to 12 bytes, cutting instance-buffer storage and upload
bytes by 40%. This is a bandwidth opportunity; it does not establish a frame-time improvement or directly reduce
palette lookups and fragment shading.

## Proposed Solution

Investigate a compact integer layout and record whether it should replace the current layout:

- Start with four signed int16 rectangle fields (`x`, `y`, `width`, `height`) and two uint16 identifiers. This keeps
  the rectangle as one GPU attribute and gives a 12-byte stride with regular 16-bit offsets.
- Evaluate `vertexAttribPointer` with `SHORT` and normalization disabled so the existing floating-point rectangle
  input and positioning calculations can remain in the shader.
- Account for signed coordinate limits of -32,768 to 32,767 and positive dimensions up to 32,767. Compare unsigned
  width/height fields, supporting up to 65,535, if their extra attribute setup is justified by actual usage.
- Audit whole-pixel assumptions and define rounding, invalid-value, and out-of-range behavior before choosing an API.
- Compare storage, upload bytes, CPU submission time, GPU time, and code complexity with the 20-byte baseline.

The outcome is an evidence-based recommendation and a concrete follow-up implementation scope. Adoption of the
12-byte format remains a decision to make after the investigation.

## Implementation Plan

### Step 1: Audit submitted rectangles

- Inspect final coordinates after nested drawing groups and viewport offsets, including plugin drawers, scrolling,
  dragging, animations, widget sizes, and supported font metrics.
- Check negative positions, large canvases, oversized code blocks, and partially visible content. Viewport-relative
  coordinates help with large world positions but do not bound every submitted rectangle.
- Identify any fractional values and decide whether explicit rounding is appropriate. Define how overflow would be
  prevented without silently wrapping typed-array writes or adding disproportionate work to every submission.

### Step 2: Compare candidate layouts

- Compare the simplest all-signed rectangle with signed positions and unsigned dimensions; retain uint16 sprite IDs
  and palette indices in both cases.
- Assess buffer-writing code, attribute setup, shader changes, alignment requirements, resource restoration, and
  public API documentation. Simpler offsets alone do not guarantee simpler code overall.
- Use a contained prototype if needed to validate the layout and measure it against the current implementation.

### Step 3: Measure and record a recommendation

- Compare identical scenes with the same sprites, palette, draw order, and draw-call count. Include 10,000- and
  50,000-sprite cases and representative editor content.
- Record upload bytes and buffer capacity separately from CPU and GPU timings. At 50,000 sprites, a 12-byte format
  would upload 600,000 bytes instead of 1,000,000 bytes per frame.
- Record hardware, browser, warmup, sampling method, timing precision, and any additional validation or clipping cost.
- Recommend adoption, revision, or deferral, with explicit limits and any required editor changes.

## Validation Checkpoints

- For a prototype, verify exact packing, signed positions, identifier boundaries, buffer growth, and upload lengths.
- Check rendering equivalence for negative coordinates, partially visible sprites, and the chosen dimension limits.
- Exercise the proposed fractional and out-of-range policy; avoid silent truncation or wrapping.
- Run the renderer's relevant standalone checks or parent Nx adapter checks, plus affected editor checks if needed.
- Keep the palette and mask-atlas behavior unchanged during comparisons so measurements isolate instance packing.

## Success Criteria

- [ ] Actual coordinate precision and range requirements are documented for core and plugin sprite submissions.
- [ ] Candidate layouts and their integer, dimension, and overflow policies are compared.
- [ ] The expected 40% instance-data reduction is verified for a 12-byte prototype, if prototyped.
- [ ] CPU and GPU results are reported separately from storage and upload savings, without assuming a speedup.
- [ ] A recommendation records the code-complexity tradeoff and the scope of any subsequent implementation.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/instanceBuffer.ts` - Packing and buffer growth.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts` - Attribute types and stride.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/shaders.ts` - Rectangle input compatibility.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/utils/drawContext.ts` - Final group offsets.
- Core and plugin drawers, renderer tests, and package documentation - Coordinate audit and any future API changes.

## Risks & Considerations

- Narrow integers can wrap silently on assignment; visible content must remain correct at range boundaries.
- Whole-pixel drawing in 8f4e does not automatically establish a suitable contract for every generic renderer consumer.
- Extra validation, clipping, or additional attributes could offset the benefit of reduced transfer sizes.
- GPU timing may remain dominated by texture lookups or pixel work; report modest or absent timing gains honestly.

## Related Items

- [TODO 510: Use glyph masks and a GPU color palette](archived/510-use-glyph-masks-and-gpu-color-palette.md) - Current
  20-byte layout and recorded rendering measurements.
- [TODO 482: Resolve sprite identifiers before drawing](archived/482-resolve-sprite-identifiers-before-drawing.md) -
  Numeric instance submission and identifier packing.

## References

- [WebGL vertex attribute types and conversion](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer)

## Notes

- Created on 2026-10-26 to investigate packing further; no renderer implementation is part of recording this TODO.
- Smaller instance data is the primary expected benefit. More regular offsets are a potential code simplification.

## Archive Instructions

When the investigation is complete, record the recommendation, set `status: Completed` and the completion date,
move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
