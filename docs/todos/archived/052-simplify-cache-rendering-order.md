---
title: 'TODO: Simplify Cache Rendering Order'
priority: Medium
effort: 2–3 days
created: 2025-09-03
issue: https://github.com/8f4e/8f4e/issues/540
status: Cancelled
completed: 2026-09-07
---

# 052 - Simplify Cache Rendering Order


The 2D engine supports caching of complex draw blocks via `cacheGroup`. The current implementation in `CachedRenderer` preserves draw order across different textures (sprite sheet vs cached textures) using a “segment” system that records texture switches and replays draws in a single render pass. While it works, it adds complexity and has been a source of regressions when experimenting with simplifications.

Recent attempt: We tried removing segment tracking and drawing cached quads immediately. This caused cached content to appear black because those quads were drawn to the canvas before the off-screen post-processing pass, which then overwrote the canvas. We reverted to the segmented approach. The goal is to safely reduce complexity without breaking ordering or the post-process pipeline.

Impact:
- Higher renderer complexity (segment bookkeeping, special render pass logic).
- Greater risk when modifying cache behavior (black quads, incorrect ordering).
- Harder for contributors (and AI agents) to reason about ordering guarantees.

## Proposed Solution

High-level approach: Bind the off-screen framebuffer (FBO) for the entire user draw phase. Ensure that all draw calls—including cached content and sprite-sheet sprites—land in the same off-screen target before post-processing. This allows immediate cached draws without manual segment tracking, because there is no mid-frame switch back to the default framebuffer.

Key changes required:
- Move FBO binding so it wraps the user callback that issues draw calls (in `Engine.render`).
- Adjust `Renderer.renderWithPostProcessing` so it does not re-bind FBO after the callback; it should only finalize the off-screen pass and then run post-processing.
- Update `CachedRenderer.drawCachedTexture` to draw immediately (flush any pending buffers for the sprite sheet, bind the cached texture, draw that quad, and continue) knowing it is still rendering to the off-screen target.
- Remove segment tracking and replay once verified safe.

Alternative approaches considered:
1) Keep segments but simplify internal API: reduces risk but retains complexity.
2) Introduce explicit `flush()` points around cached draws: simpler but harms batching and still prone to texture-binding order bugs.

## Implementation Plan

### Step 1: Baseline snapshot and tests
- Create a working branch; confirm current HEAD (segment-based) passes typecheck and tests for `glugglugglug`.
- Add/extend unit tests covering: cached reuse path, creation path, interleaving spritesheet and cached draws, and post-process interaction.

### Step 2: Bind off-screen FBO for entire frame
- In `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/engine.ts`, move “start render to texture” from `Renderer.renderWithPostProcessing` to wrap the user callback: bind FBO and set viewport before invoking the callback; unbind after draws are scheduled.
- Ensure `Renderer.updateTime`, `clearScreen`, and other per-frame setup still run in the correct order.

### Step 3: Adjust renderWithPostProcessing
- In `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts`, change `renderWithPostProcessing` to assume the FBO already contains the final scene; it should only end the FBO pass if still bound, then run post-processing to the canvas.
- Verify no mid-function rebinding to the default framebuffer occurs before post-processing completes.

### Step 4: Make cached draws immediate and remove segments
- In `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/CachedRenderer.ts`:
  - Update `drawCachedTexture` to flush pending spritesheet data, bind cached texture, draw the cached quad immediately to the FBO, and resume batching.
  - Remove segment tracking code (`segments`, `ensureSegment`, segment replay in `renderWithPostProcessing`).
  - Keep cache management (maps, FBO creation, LRU) unchanged.

### Step 5: Validate in the editor and examples
- Test `packages/editor` code paths that use `cacheGroup`, especially code block rendering where many caches are used.
- Validate order visually: cached content appears exactly at the invocation site relative to surrounding sprites.
- Confirm post-process effects still apply uniformly to both sprites and cached content.

### Step 6: Documentation and cleanup
- Update `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/examples/cache-usage.md` to note that `cacheGroup` both creates and draws at the call site; no special ordering considerations are necessary.
- Remove obsolete comments referencing segment logic.

## Success Criteria

- [ ] Cached quads render with correct textures (never black) and correct ordering without segment tracking.
- [ ] Post-processing applies to both spritesheet and cached content consistently.
- [ ] No frame-to-frame ordering regressions when interleaving cached and non-cached draws.
- [ ] Typecheck and tests pass for `glugglugglug` and the editor.
- [ ] Examples render identically (or with intended improvements) compared to baseline.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/engine.ts` — Move FBO binding around user callback in `render`.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts` — Adjust `renderWithPostProcessing` lifecycle (end FBO + post-process only).
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/CachedRenderer.ts` — Simplify cached draw path; remove segment tracking; immediate draws to FBO.
- `packages/editor/packages/editor-core/src/view/drawers/...` — No code changes expected; validate behavior with `cacheGroup` sites.
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/tests/*` — Update tests to align with immediate cached draws and FBO-wrapped frame.

## Risks & Considerations

- **WebGL state assumptions**: Some code may implicitly assume the default framebuffer during the callback; audit and adapt.
- **Batching efficiency**: Immediate cached draws will introduce flushes; measure performance to ensure acceptable impact.
- **Post-process correctness**: Ensure effects expect input from the off-screen texture pipeline.
- **Hidden texture binds**: Confirm no implicit sprite-sheet rebinds interfere with cached draws.
- **Editor integration**: Heavily cached editor views (code blocks) must retain correct z-order.

## Related Items

- Related/History: `todo/archived/050-glugglugglug-cache-groups-renderer-approach.md` (original cache design discussion)
- This TODO replaces attempts tracked in conversation where segment removal caused black quads.

## References

- Files:
  - `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/engine.ts`
  - `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/renderer.ts`
  - `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/CachedRenderer.ts`
  - `packages/editor/packages/editor-core/src/view/drawers/codeBlocks/index.ts`
- Concepts: WebGL FBO rendering, post-processing pipelines, batching and texture binding.

## Notes

- Current state restored to last known-good segment-based implementation from git.
- `cacheGroup` API in `CachedEngine` (with optional `enabled` flag) remains the user-facing contract.
- Start/End cache APIs were removed from `CachedEngine` (use `cacheGroup`).
- An earlier attempt to remove segments drew cached quads immediately to the canvas and clashed with the off-screen pass, resulting in black output.

## Archive Instructions

When completed, move this file to `todo/archived/` and note the final approach taken (ideally Option 1 with FBO-bound frame) and any measured performance differences.
