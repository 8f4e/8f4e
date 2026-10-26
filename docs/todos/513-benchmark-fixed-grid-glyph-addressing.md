---
title: 'TODO: Benchmark fixed-grid glyph addressing'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
---

# TODO: Benchmark fixed-grid glyph addressing

## Problem Description

The sprite vertex shader fetches each source rectangle from a GPU lookup texture. The editor currently generates
128 fixed-cell glyphs in a 16-column grid, one fill texel, and one background pattern mask. This regular layout
could let the shader derive source rectangles from a glyph identifier and font dimensions instead of fetching them.

The alternative adds arithmetic and special handling for the fill and background. The current rectangle table is
only 1,040 bytes for 130 shapes and may be served efficiently by GPU caches. Removing its texture fetch does not
establish a speedup: shader arithmetic, texture latency, and other rendering work can overlap.

## Proposed Investigation

Compare the current rectangle lookup with a contained fixed-grid prototype before deciding whether to restrict the
renderer to this atlas layout. Recording this TODO does not implement the prototype or adopt the restriction.

- Derive a glyph's column and row from its identifier using a mask and shift for the 16-column grid.
- Calculate its source origin and size using the active font's dimensions.
- Handle the shared fill texel and background pattern explicitly, preserving their source rectangles and scaling.
- Establish how installed sprite identifiers map to glyph codes and primitive kinds; do not assume arbitrary dense
  renderer IDs already carry those meanings.
- Evaluate the loss of arbitrary source-rectangle support and the complexity of the resulting renderer contract.
- Retain the R8 atlas, palette texture, 20-byte instance records, draw order, and draw-call count during comparisons.

Palette transport, integer instance packing, visible-cell culling, and text-cache changes are separate experiments.
The mask texture sampling, palette lookup, and blending work remain part of both benchmark variants.

## Implementation Plan

### Step 1: Define equivalent shader variants

- Record the existing shader, atlas layout, source identifiers, and resource setup as the baseline.
- Define the fixed-grid shader's required font/layout uniforms and its fill/background cases.
- Include atlas replacement with every supported font and rendering-resource release/restoration in the design.
- Keep the prototype isolated so benchmark setup can select either variant without requiring a permanent dual API.

### Step 2: Verify rendering equivalence

- Compare all 128 glyphs, including control-character glyphs, digits, spaces, and the fallback character.
- Exercise the fill and both offset background layers, scaled glyphs, and partially visible sprites.
- Verify source-texel boundaries, nearest-neighbor sampling, alpha behavior, and font-dimension changes using the
  existing renderer, generator, editor, and connector browser fixtures.
- Preserve existing visual baselines; investigate differences before comparing performance.

### Step 3: Measure the tradeoff

- Run identical 10,000- and 50,000-sprite scenes plus representative editor content. Include mixed glyph, fill, and
  background workloads so special-case handling is represented.
- Measure GPU time separately from CPU submission and resource setup. Use GPU timer queries where available,
  discard disjoint samples, and report GPU timing as unavailable when it cannot be measured reliably.
- Warm up both variants, repeat measurements, and record timing resolution, distributions, browser, GPU, and driver.
- Record changes in texture storage, bindings, instance uploads, and code complexity separately from frame times.
- Recommend adoption only when repeatable gains justify the layout restriction. An unchanged or slower result is
  a valid outcome; document whether to retain the existing rectangle lookup or investigate a narrower alternative.

## Success Criteria

- [ ] The fixed-grid contract and its restrictions are documented, including identifier mapping and primitive cases.
- [ ] The prototype renders equivalently across supported fonts and existing browser fixtures.
- [ ] CPU and GPU measurements compare equivalent workloads with other optimizations held constant.
- [ ] Results account for timing noise and do not infer speed from instruction count or texture-fetch count alone.
- [ ] A recommendation records measured benefits, regressions, complexity, and any follow-up implementation scope.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/shaders.ts` - Source addressing.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts` - Uniforms and textures.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/atlasLayout.ts` - Grid contract.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts` - Shape identifiers.
- Existing renderer, generator, editor, and connector rendering fixtures and benchmark tooling.

## Related Items

- [TODO 510: Use glyph masks and a GPU color palette](archived/510-use-glyph-masks-and-gpu-color-palette.md) - Current
  renderer design and baseline measurements.
- [TODO 512: Investigate integer sprite instance packing](512-investigate-integer-sprite-instance-packing.md) - Separate
  instance-bandwidth investigation; keep its changes out of this comparison.

## Archive Instructions

When the investigation is complete, record the recommendation, set `status: Completed` and the completion date,
move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
