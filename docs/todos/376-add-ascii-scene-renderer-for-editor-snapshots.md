---
title: 'TODO: Add ASCII scene renderer for editor snapshot tests'
priority: Medium
effort: 1-2d
created: 2026-04-08
issue: https://github.com/8f4e/8f4e/issues/558
status: Open
completed: null
---

# TODO: Add ASCII scene renderer for editor snapshot tests

## Problem Description

The editor currently has strong unit coverage for directive parsing, layout derivation, and individual widget geometry, but it does not have a cheap whole-scene regression layer for rendered code blocks.

That leaves a gap between:

- pure object snapshots that assert widget coordinates in isolation
- expensive browser/image-based visual tests that are better reserved for rasterization and real rendering fidelity

As a result, regressions in composed editor scenes can slip through without an ergonomic test harness:

- z-order and overwrite behavior when blocks overlap
- viewport clipping and anchored block placement
- collapsed/hidden block rendering
- line-number and tab-stop alignment
- multi-block composition bugs that only show up after the final scene is painted

## Proposed Solution

Add a browser-free ASCII renderer under `packages/editor` that accepts editor state and produces deterministic text output for snapshot tests.

The renderer should behave like a coarse rendering backend:

- consume the same derived block/layout data used by the editor
- render the whole visible scene into a shared character grid
- mirror production paint order so later draws overwrite earlier cells
- serialize the final grid as text for Vitest snapshots

This should be implemented as a library, not a CLI-first tool. The core API should return text or a structured text buffer, and tests should remain responsible for snapshot storage.

The main snapshot coverage should live in `editor-state`, while the ASCII renderer package should keep its own focused unit tests for painting semantics.

## Anti-Patterns

- Do not make the ASCII renderer recompute editor layout through separate logic when it can consume existing derived state.
- Do not snapshot blocks only in isolation if the goal is to catch overlap and z-order bugs.
- Do not move normal editor test coverage into expensive browser/image tests when the behavior can be asserted through deterministic text composition.
- Do not let a CLI own rendering behavior; any CLI should be a thin wrapper around the library if one is added later.

## Implementation Plan

### Step 1: Create a pure ASCII renderer package under editor
- Add a new browser-free package under `packages/editor/packages/`.
- Expose a small API such as `renderStateToAscii(state, options): string`.
- Keep dependencies limited to editor-state and shared pure helpers.

### Step 2: Define scene composition and paint-order rules
- Mirror production ordering for normal blocks, viewport-anchored blocks, always-on-top blocks, widgets, and overlays that should affect snapshots.
- Render into a shared 2D character buffer with overwrite semantics.
- Keep the glyph vocabulary intentionally small and stable so snapshots stay readable.

### Step 3: Add initial snapshot coverage in editor-state
- Add whole-scene snapshot tests for overlapping blocks and z-order.
- Add coverage for collapsed blocks, tab alignment, and viewport-anchored placement.
- Keep rare browser/image tests focused on rasterization fidelity and real renderer behavior.

## Success Criteria

- [ ] A pure ASCII renderer exists under `packages/editor` and can render editor state without browser APIs.
- [ ] Full-scene snapshots can detect overwrite/z-order regressions when blocks overlap.
- [ ] `editor-state` has snapshot coverage for at least one overlapping-scene case and one layout/alignment case.
- [ ] Browser/image-based visual tests remain optional and focused on rasterization-specific correctness.

## Affected Components

- `packages/editor/packages/` - new ASCII renderer package
- `packages/editor/packages/editor-core/packages/editor-state/` - scene snapshot tests using the new renderer
- `packages/editor/packages/editor-core/src/` or shared render-order helpers - any production ordering logic that should be centralized and reused
- `docs/todos/` - tracking and follow-up documentation

## Risks & Considerations

- **Render-order drift**: If the ASCII renderer does not mirror production ordering, the tests will be reassuring but incorrect.
- **Duplicate layout logic**: Recomputing layout separately from editor-state would make snapshots brittle and hard to trust.
- **Snapshot noise**: Too many glyph types or overly detailed output will make review harder.
- **Scope creep**: The first version should focus on deterministic composition, not browser parity or font rasterization.

## Related Items

- Related: `048-add-2d-engine-visual-regression-tests.md`
- Related: `364-centralize-alwaysontop-code-block-partition-logic.md`

## Notes

- The motivating use case is cheap CI-friendly visual coverage for text-grid-aligned code blocks without PNG fixtures or headless browser runs on every change.
- Proper browser/image visual tests are still useful for font rasterization and real rendering fidelity, but they should run less frequently than the ASCII snapshots.
