---
title: 'TODO: Lazy-load WASM overlay rendering'
priority: Medium
effort: 1-2d
created: 2026-09-06
issue: https://github.com/8f4e/8f4e/issues/958
status: Open
completed: null
---

# TODO: Lazy-load WASM Overlay Rendering

## Problem Description

The web UI eagerly imports `createWasmOverlayTextureDrawer` and `RgbaTextureLayer`. Projects without a framebuffer
overlay still download the implementation, although they do not initialize its rendering resources.

## Proposed Solution

Load the overlay drawer and RGBA layer implementation only when the resolved overlay-texture configuration first requires
them. Keep configuration/schema discovery available during startup. Share the module-loading promise while keeping
rendering resources owned by each editor instance.

## Implementation Plan

1. Measure the production entry and its static dependencies before changing the import boundary. Check whether the
   web-ui's import boundaries allow the RGBA implementation to stay outside the initial bundle.
2. Introduce an asynchronous loader triggered by resolved overlay configuration. Start drawing once the latest
   configuration, compiled code, and memory are ready; preserve topmost overlay ordering relative to other layers.
3. Keep configuration changes event-driven while handling configuration changes and disposal during loading. Preserve
   rendering pause/resume and resource-release behavior.
4. Verify the emitted chunks and compare initial minified/gzip bytes and first-overlay readiness.

## Success Criteria

- [ ] Editors without a configured framebuffer overlay do not fetch the optional implementation.
- [ ] Initial configuration and later configuration changes activate the correct overlay.
- [ ] Concurrent editors share module loading but retain independent resources.
- [ ] Late loads cannot resurrect disposed resources.
- [ ] Rendering order, memory/code updates, and resource release/resume retain their behavior.
- [ ] Before/after production measurements demonstrate that the initial-download savings justify the added complexity.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/src/index.ts`
- `packages/editor/packages/editor-core/packages/web-ui/src/drawers/wasmOverlayTexture.ts`
- `packages/editor/packages/editor-core/packages/web-ui/src/plugins/rgba-texture-layer/`

## Risks & Considerations

Adding a dynamic import is insufficient if another static import retains the same implementation. Inspect the final
website bundle, including any shared chunks. Loading must not introduce asynchronous work into every draw call. The
previous implementation saved about 2.6 kB gzip, so a future attempt should first establish that this small reduction is
worth the lifecycle complexity.

## Validation Checkpoints

- Run `npx nx run-many --target=test --projects=@8f4e/web-ui,@8f4e/editor-core` and corresponding typechecks.
- Run `npx nx run @8f4e/editor-website:build` and inspect the resulting dependency graph and network requests.
- Exercise projects with and without overlays, configuration changes during loading, and disposal/release/resume.
- Run relevant web UI screenshot checks for layer ordering.

## Related Items

- [TODO 484: Lazy-load context-menu builders](archived/484-lazy-load-context-menu-builders.md) — another isolated initial-bundle reduction.

## References

- [Web UI initialization](../../packages/editor/packages/editor-core/packages/web-ui/src/index.ts)

## Notes

An implementation completed on 2026-09-11 reduced the initial editor bundle by about 2.6 kB gzip, but was removed before
release because its asynchronous module and resource lifecycle added more complexity than the small saving justified.
The event-driven configuration path remains and should not be replaced with render-loop polling in any future attempt.

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
