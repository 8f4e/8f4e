---
title: 'TODO: Compose input and output icons at runtime'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Completed
completed: 2026-10-26
---

# TODO: Compose input and output icons at runtime

## Problem Description

The sprite generator prerenders the input connector `[ ]` and six output connector `[*]` variants into the atlas.
Each sprite combines a solid background, font brackets, and, for outputs, a star whose color represents the current
value. All of these parts already exist as ordinary font and fill sprites.

Compose these connectors in the drawer at runtime and remove the dedicated atlas entries. Do this before
[TODO 510: Use glyph masks and a GPU color palette](../510-use-glyph-masks-and-gpu-color-palette.md), using the current
colored font rows and fill sprites. This isolates the composition change so its appearance and rendering cost can
be verified before changing the renderer's texture format and drawing API.

## Proposed Solution

- Draw an input connector as a three-cell background fill followed by `[` and `]` in the first and third cells.
- Draw an output connector as the same background geometry, brackets, and a `*` in the middle cell. Select the star's
  existing font color from the current six-step output scale.
- Preserve the current token choices: `surfaceRaised2` for backgrounds, `primaryBase` for input brackets,
  `secondaryBase` for output brackets, and `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`,
  `warningBase`, and `negativeBase` for the six output states.
- Reuse existing font and fill drawing primitives. A small connector helper is appropriate if it removes duplicated
  geometry while keeping input and output color choices explicit.
- Remove the dedicated input icon and feedback-scale generation, atlas regions, lookup groups, and unused exports.
  The project is unreleased; compatibility shims are unnecessary.

## Implementation Plan

### Step 1: Compose connectors from existing sprites

- Update the connector drawer to render a scaled background fill and ordinary font glyphs using current font metrics
  and viewport grid dimensions.
- Keep background-before-glyph ordering and the existing connector positions, three-cell widths, and heights.
- Keep output memory reads, non-finite value handling, calibration, scale rounding, and clamping unchanged. Use the
  resulting scale index to select a font color rather than a prerendered composite sprite.
- Keep the output scale's token ordering in one place close to the connector drawing logic.

### Step 2: Remove prerendered connector assets

- Remove the input icon and feedback-scale drawing commands from sprite generation and compact the remaining atlas
  layout without retaining empty slots.
- Remove their lookup groups, required fallback declarations, exported icon constants, and other APIs that have no
  remaining consumers.
- Update editor state types, renderer fixtures, mocks, atlas tests, and documentation that assume those groups exist.
- Keep the current renderer, colored font rows, fill sprites, and background generation for this separate change.
  Introduce R8 masks and the GPU palette later in TODO 510.

### Step 3: Verify behavior and rendering cost

- Cover the input's background and bracket placement and the output's background, brackets, and star placement.
- Cover all six output color states, representative integer/float32/float64 reads, non-finite values, and calibration
  boundaries while preserving the current scale behavior.
- Review visual regressions with the supported font sizes and representative themes, checking grid alignment,
  background coverage, and exact foreground color choices.
- Confirm dedicated connector atlas entries and lookup groups are gone and the existing sprite batching is retained.
- Measure representative connector-heavy scenes. Expect three sprite instances per input and four per output instead
  of one composite instance; record the upload-byte and frame-time impact before the R8 migration.

## Validation Checkpoints

- Run sprite-generator and web-ui build, unit tests, and typecheck through Nx.
- Run affected editor-core checks and build the consuming website to catch removed lookup/export consumers.
- Run sprite-generator and web-ui screenshot suites and inspect intentional atlas-layout changes.
- Confirm the remaining atlas still contains ordinary font and fill entries used by the new composition.

## Success Criteria

- [x] Inputs and outputs are assembled at runtime from existing font and fill sprites.
- [x] Connector geometry, colors, output calibration, and scale selection retain their current behavior.
- [x] The dedicated input icon and six feedback-scale atlas sprites, lookups, and unused exports are removed.
- [x] Atlas layout is compacted and affected consumers, fixtures, and documentation are updated.
- [x] No R8 texture, GPU palette, or renderer instance-format change is included in this task.
- [x] Unit checks and visual regressions pass, and the additional instance/upload cost is measured.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/src/drawers/codeBlocks/widgets/connectors.ts` - Runtime
  composition and output color selection.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/` - Remove icon/feedback-scale
  generation, atlas regions, lookup groups, and tests tied to prerendered connectors.
- `packages/editor/packages/editor-core/packages/editor-state/` and related state types - Remove obsolete lookup
  assumptions where present.
- Editor/core/plugin test fixtures, screenshots, and color documentation - Updated composition and atlas shape.

## Risks & Considerations

- Runtime composition adds instances and upload bytes even though it removes duplicate pixels. Preserve batching
  and measure the actual cost rather than assuming a rendering speedup.
- Inputs and outputs currently use different bracket colors. Sharing geometry must not silently unify those colors.
- Removing lookup groups can affect fixtures outside the connector drawer; migrate all consumers directly.
- The background pattern and its planned offset-mask reuse belong to TODO 510 and are outside this task.

## Implementation Notes

The connector drawer now submits three instances per input and four per output, preserving the existing calibration,
six output colors, and different input/output bracket colors. The generator no longer exposes icon or feedback-scale
lookup groups. Fills begin beside the background immediately below the font rows.

The current bounded font catalog did not include `primaryDark3` or `primaryDark1`. Both shades were added as ordinary
fonts to preserve the existing output colors. For the default 8x16 font, this increases atlas storage from 3.875 MiB
to 4 MiB and the number of sprite definitions from 4,037 to 4,286, despite removing seven composite sprites. The
worst-case catalog still fits the 8,192-entry lookup budget. TODO 510 will remove the colored font duplication.

A local headless Chromium comparison used a 1280x800 canvas with 1,000 inputs and 1,000 outputs. It reconstructed the
seven legacy composites from the same glyph and fill pixels, then alternated both paths on the same renderer and
atlas. After warming up, 30 batches of 10 frames gave the following medians:

| Measurement | Prerendered composites | Runtime composition |
| --- | ---: | ---: |
| Sprite instances per frame | 2,000 | 7,000 |
| Instance upload bytes per frame | 40,000 | 140,000 |
| CPU frame submission | 0.05 ms | 0.15 ms |
| Submission plus `gl.finish()` | 0.05 ms | 0.15 ms |

These are local stress-test timings at the browser timer's precision, not isolated GPU timings or a general frame-rate
guarantee. Both paths retain one instanced sprite draw call.

Nine connector screenshots were captured before the implementation and matched after it: `6x10`, `ibmvga8x16`, and
`spleen16x32`, each with default, distinct primary/secondary, and translucent palettes. The atlas screenshots and the
last font-catalog page change intentionally because of the new rows and removed composite regions.

Validation: palette, sprite-generator, web-ui, and editor-core unit tests and typechecks passed (319 unit tests),
along with both screenshot suites (24 browser tests), the editor website production build, and Biome checks.

## Related Items

- **Follow-up:** [TODO 510: Use glyph masks and a GPU color palette](../510-use-glyph-masks-and-gpu-color-palette.md).
  Perform this connector composition change first, then migrate its primitives to masks and palette indices.

## References

- [Connector drawer](../../../packages/editor/packages/editor-core/packages/web-ui/src/drawers/codeBlocks/widgets/connectors.ts)
- [Atlas layout](../../../packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/atlasLayout.ts)
- [Font palette catalog](../../../packages/editor/packages/editor-core/packages/editor-palette/src/index.ts)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
