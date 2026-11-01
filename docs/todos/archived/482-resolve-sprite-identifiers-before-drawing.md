---
title: 'TODO: Resolve sprite identifiers before drawing'
priority: Medium
effort: 2-4h
created: 2026-09-06
issue: https://github.com/8f4e/8f4e/issues/957
status: Completed
completed: 2026-10-01
---

# TODO: Resolve Sprite Identifiers Before Drawing

## Problem Description

`glugglugglug` converted every `drawSprite()` identifier to a string and resolved it through a `Map`, then wrote the
resolved dense sprite id and dimensions into its instance buffer. The editor already submitted numeric sprite identifiers,
so every glyph still incurred string conversion and map lookup after its semantic sprite role had been resolved.

Atlas metadata is stable between atlas replacements. Public identifiers can instead be resolved once during setup and the
resulting dense numeric ids can index CPU sprite metadata directly during drawing.

## Implemented Solution

Public atlas lookup keys are now separate from resolved ids belonging to the active atlas:

- `Engine.setSpriteAtlas()` returns a setup-time resolver for public string or numeric keys.
- `drawSprite()` accepts branded dense `SpriteId` values and reads default dimensions directly from packed metadata.
- Sparse numeric keys and string names retain the existing string/number normalization during cold-path resolution.
- The sprite generator emits grouped public identifiers and provides `resolveSpriteIds()` to rebuild semantic lookup
  tables against the installed atlas.
- Web UI and editor-core replace their resolved sprite tables whenever the atlas changes, before rendering resumes.
- The 20-byte GPU instance format, optional destination dimensions, append order, and validation-free drawing policy are
  unchanged.

Resolved ids are atlas-specific. Replacing an atlas invalidates ids from the previous resolver; consumers rebuild their
lookup tables rather than adding per-draw generation checks.

## Measurements

The retained `glugglugglug:benchmark:submission` browser benchmark uses 4,096 sprite definitions, preallocated instance
buffers, default and explicit sprite dimensions, alternating variant order, warmup rounds, and median measurements. The
2026-10-01 validation run produced byte-identical instance data:

| Sprites per frame | Map and string lookup | Dense metadata lookup | Approximate reduction |
| ----------------- | --------------------- | --------------------- | --------------------- |
| 10,000 | 0.096 ms | 0.020 ms | 79.2% |
| 100,000 | 1.320 ms | 0.400 ms | 69.7% |

These timings isolate CPU sprite submission and exclude WebGL uploads and GPU rendering; they are not whole-frame
speedups.

## Success Criteria

- [x] `drawSprite()` performs no identifier string conversion or map lookup.
- [x] Public names and sparse numeric keys resolve to the correct dense ids during setup.
- [x] Default dimensions, explicit dimensions, sprite order, and emitted instance bytes retain their behavior.
- [x] Editor sprite roles and font tables are rebuilt against the active atlas after replacement.
- [x] Drawing utilities use the same resolved-id contract.
- [x] Invalid or stale ids remain programmer errors without new per-sprite runtime validation.
- [x] Unit tests, repository-wide typechecks, renderer and web UI visual regressions, and the retained benchmark pass.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/{types,spriteAtlas,renderer,engine}.ts`
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/utils/`
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/docs/adr/001-no-programmer-input-validation-in-the-sprite-hot-path.md`
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/`
- `packages/editor/packages/editor-core/packages/web-ui/`
- `packages/editor/packages/editor-core/`

## Validation

- Affected unit suites: 344 tests passed across `glugglugglug`, sprite-generator, web-ui, and editor-core.
- Repository-wide `typecheck`: 34 projects passed.
- Visual coverage: the compact renderer screenshot and all four web UI browser-rendering tests passed.
- Benchmark: byte-equivalent output with 79.2% and 69.7% lower isolated submission time at 10,000 and 100,000 sprites.

Two unchanged sprite-generator atlas-dump snapshots did not match their stored images under the current local system
Chrome. They exercise direct `OffscreenCanvas` atlas display rather than identifier resolution; the sprite-generator unit
suite and the migrated engine-backed atlas rendering case passed.
