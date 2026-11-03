---
title: 'TODO: Add Framebuffer Memory Accounting in glugglugglug'
priority: Medium
effort: 2-4h
created: 2025-12-30
issue: https://github.com/8f4e/8f4e/issues/548
status: Cancelled
completed: 2026-09-07
---

# TODO: Add Framebuffer Memory Accounting in glugglugglug

## Problem Description

glugglugglug allocates render-to-texture and cache framebuffers, but there is no structured accounting for their estimated memory impact. This makes it difficult to reason about GPU memory usage when cache sizes grow or when the canvas is resized.

## Proposed Solution

Add a lightweight accounting layer that estimates bytes for framebuffer-backed textures (RGBA8) and exposes them via a small stats API. Track render target size changes and cache additions/evictions to keep the estimate current.

## Implementation Plan

### Step 1: Add render target accounting
- Track estimated bytes for the main render texture in `Renderer.createRenderTexture`.
- Update the estimate on resize.

### Step 2: Add cache framebuffer accounting
- Track per-cache texture sizes in `CachedRenderer`.
- Update totals on create/evict/clear.

### Step 3: Expose stats
- Provide a small API (e.g., `getMemoryStats()`) returning totals and breakdown.

## Success Criteria

- [ ] Estimated framebuffer memory is tracked for the render target.
- [ ] Cached framebuffer textures update totals on create/evict/clear.
- [ ] A public stats method exposes totals for debugging or profiling.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts` - render target accounting
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/CachedRenderer.ts` - cache accounting
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/types.ts` - optional stats types

## Risks & Considerations

- **Accuracy**: Estimates won’t match actual GPU allocations; document as approximate.
- **Format assumptions**: Current implementation uses RGBA8; revisit if formats change.

## Related Items

- **Related**: TODO 052 (Simplify Cache Rendering Order)

## Notes

- Keep accounting additive and side-effect free; avoid touching render flow.
