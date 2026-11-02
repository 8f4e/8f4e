---
title: 'TODO: Use glyph masks and a GPU color palette'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Completed
completed: 2026-10-26
---

# TODO: Use glyph masks and a GPU color palette

## Problem Description

The sprite generator renders all 128 font glyphs once for every distinct resolved palette color. Identical colors
share a row, but adding shades still duplicates the same glyph shapes across the atlas. Theme changes also require
regenerating and uploading pixels whose shapes have not changed.

Separate sprite shape from color: store glyph coverage once and upload a small color palette independently. Drawers
should select a glyph and a palette entry instead of selecting a separate colored glyph sprite.

The project has not been released. Implement this as a clean API migration across the renderer, sprite generator,
core, and plugins; compatibility with the existing APIs and atlas format is not required.

## Proposed Solution

- Generate one color-independent mask per glyph in a single-channel `R8` atlas, with nearest-neighbor sampling for
  the bitmap fonts. Each texel stores one byte of coverage; the fragment shader reads the red channel.
- Upload a GPU palette containing resolved RGBA colors at initialization and when the palette changes.
- Give each sprite instance a sprite ID and a palette index alongside its destination position and size.
- Fetch the palette entry in the vertex shader and pass the resolved color to the fragment shader as a flat varying.
  Apply glyph coverage and opacity using the renderer's premultiplied-alpha convention.
- Keep palette handling generic in `glugglugglug`: numeric indices and RGBA entries. `@8f4e/editor-palette` owns
  semantic tokens, shades, aliases, and their stable index mapping.
- Preserve distinct token indices even when two tokens currently resolve to the same color. Changing a theme must
  update values without changing which token an existing index represents.
- Target the existing 20-byte instance size: four 32-bit floats for position and size, followed by a 16-bit sprite ID
  and a 16-bit palette index. Document and enforce the resulting limits during resource setup.
- Make the main sprite atlas mask-based. Replace baked solid-color sprites with a shared fully covered mask and a
  palette index. Migrate the runtime input/output composition introduced separately in TODO 511 to the new primitives.
- For the background, draw its base fill and reuse the same pattern mask in overlapping instances with different
  palette selections and positional offsets. Do not prerender separate colored versions of the background pattern.

## Implementation Plan

[TODO 511: Compose input and output icons at runtime](511-compose-input-output-icons-at-runtime.md) is complete,
using the existing colored font and fill sprites. Build on that runtime composition while changing the underlying
resources and drawing APIs in this task.

### Step 1: Define the palette and instance contracts

- Define the generic renderer palette upload/update API and the sprite drawing API carrying a palette index.
- Define palette entry encoding, index bounds, and the stable editor token-to-index mapping.
- Pack the sprite ID and palette index into the final four bytes of each reusable instance record. Keep instance
  submission allocation-conscious and validate resource definitions outside the draw hot path.
- Update renderer types, drawing utilities, exports, and fixtures directly. Remove superseded contracts rather than
  introducing compatibility overloads or adapters.

### Step 2: Add GPU palette resources and shader color lookup

- Allocate a small palette texture and fetch its entries in the vertex shader without splitting batches by color.
- Combine the selected RGBA color with mask coverage in the fragment shader, preserving premultiplied alpha,
  transparent pixels, translucent colors, and insertion order.
- Update palette storage only when its values change; keep mask and rectangle metadata textures unchanged during a
  palette-only update.
- Include palette resources in replacement, disposal, memory release, and restoration. Retain enough CPU data to
  restore the current palette, and reestablish palette bindings after render hooks alter WebGL state.

### Step 3: Replace color-dependent atlas generation

- Generate one font glyph set and shape-only lookups, removing per-color font rows and colored-font lookup groups.
- Generate single-channel coverage bytes and upload the atlas with `R8` internal format, `RED` source format, and
  `UNSIGNED_BYTE` data. Store zero for uncovered pixels and 255 for fully covered pixels, and sample `.r` as normalized
  coverage. Use a byte-array upload path rather than retaining an RGBA mask atlas.
- Set the unpack alignment explicitly for single-channel rows, including widths that are not multiples of four.
- Use a shared opaque mask for solid rectangles. Migrate the connector fills and glyphs from TODO 511 to masks and
  palette indices, and replace any remaining baked composites with runtime composition.
- Generate one reusable background pattern mask and layer offset instances over the base fill. Preserve the pattern's
  alignment at tile boundaries without expanding the background into an instance per dot.
- Review atlas packing to avoid retaining a large mostly empty atlas after the font rows are removed.
- Make atlas dimensions and sprite identities depend on shapes and font metrics rather than resolved color values.

### Step 4: Migrate editor and plugin consumers

- Have core and plugin drawers select shape IDs and palette indices explicitly, using the same token catalog for
  fills, text, and other tinted sprites.
- Separate palette updates from font/shape updates in the editor lifecycle. A theme-only change uploads the new
  palette; a font change rebuilds masks and rectangle metadata as needed.
- Remove the old baked-color atlas generation, lookup APIs, and obsolete tests. Update renderer documentation,
  color-path documentation, and affected `AGENTS.md` guidance to describe the new model.

### Step 5: Verify rendering and measure the tradeoff

- Cover instance packing, maximum representable IDs, palette index stability across themes, and equal-color tokens
  that diverge after a palette update.
- Verify palette uploads occur on changes rather than every frame, and that palette-only updates do not regenerate
  or reupload the atlas or rectangle metadata.
- Cover resource release/restoration, palette replacement, and rendering after hooks change texture bindings.
- Cover single-channel uploads, odd-width mask rows, and red-channel coverage sampling for transparent and opaque
  pixels.
- Review screenshots for fonts, fills, background patterns, multicolor indicators, icons, and core/plugin drawers,
  including transparent and translucent palette entries, offset background layers, and pattern tile boundaries.
- Compare atlas dimensions and estimated texture bytes, palette bytes, uploaded instance bytes, draw-call counts,
  and CPU/GPU frame times on representative editor scenes. Include any additional instances needed for composites.
  Treat memory savings and frame-time changes as separate outcomes.

## Validation Checkpoints

- Run `glugglugglug` build, typecheck, unit tests, and screenshot tests using its standalone scripts or parent Nx
  adapter, as described in its `AGENTS.md`.
- Run sprite-generator build, unit tests, typecheck, and screenshot tests through Nx.
- Run palette, web-ui, editor-core, and affected plugin checks through Nx, then build the consuming website.
- Confirm a palette-only theme update changes text, fills, patterns, and indicators while retaining the same atlas
  pixels and sprite metadata.
- Confirm the instance stride remains 20 bytes and differently colored sprites still share the instanced batch.

## Success Criteria

- [x] Each glyph shape is stored once, independently of the number of palette colors or shades.
- [x] The mask atlas uses `R8` storage with one coverage byte per texel, sampled from the red channel.
- [x] The renderer accepts a generic GPU palette and a palette index per sprite.
- [x] Editor palette tokens have stable indices across theme changes, including tokens with equal current colors.
- [x] Sprite instances retain the 20-byte layout, with explicit 16-bit sprite ID and palette index limits.
- [x] Palette lookup happens in the vertex shader and colors do not require separate draw calls.
- [x] Palette-only updates refresh all migrated sprite colors without rebuilding or reuploading the atlas.
- [x] Runtime connector composition from TODO 511 uses masks and palette indices; background layers reuse one pattern
  mask with offsets.
- [x] Premultiplied alpha, nearest-neighbor bitmap rendering, and compositing order remain correct.
- [x] Palette resources participate in renderer memory release, restoration, and disposal.
- [x] Core/plugin consumers use the new APIs and obsolete colored sprite APIs are removed without compatibility shims.
- [x] Tests and screenshots pass, and atlas memory, submission bandwidth, draw counts, and frame times are compared.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/` - Public APIs, instance packing,
  shaders, palette resources, drawing utilities, lifecycle, and renderer tests.
- `packages/editor/packages/editor-core/packages/editor-palette/` - Stable token indices and resolved GPU entries.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/` - Shape-only atlas generation,
  packing, lookups, and composite sprite replacement.
- `packages/editor/packages/editor-core/packages/web-ui/` - Core drawers, rendering fixtures, and screenshots.
- `packages/editor/packages/editor-core/src/spriteSheetManager.ts` and editor initialization - Separate theme and
  font resource updates.
- `packages/editor/packages/editor-plugin-*/` - Palette-index drawing calls and affected tests.
- Renderer/editor documentation and package guidance - New resource and drawing contracts.

## Risks & Considerations

- A smaller static atlas does not guarantee faster rendering. Palette fetches, mask composition, CPU submission, and
  background instance counts must be measured together.
- Converting multicolor sprites into multiple instances can increase upload bytes and overdraw even if each instance
  remains 20 bytes. Preserve visual layering and review the representation of repeated patterns.
- The `R8` atlas requires a single-channel byte-array upload path, explicit row alignment, and red-channel coverage
  sampling; do not read its default alpha channel as mask coverage. Palette entries still contain RGBA colors.
- Validate both the packed 16-bit limits and the device's actual texture-size limits during resource setup.
- Coordinate changes to the independent `glugglugglug` package with parent-workspace consumers. No released API
  compatibility or migration shim is needed.

## Completion Notes

Implemented on 2026-10-26. The renderer accepts R8 coverage byte arrays and a separate RGBA8 palette. Each sprite
record contains four float32 coordinates/sizes, a uint16 shape ID, and a uint16 palette index, retaining the 20-byte
stride and a single ordered sprite batch. Palette lookup runs in the vertex shader and the fragment shader applies
red-channel coverage to premultiplied color.

The editor uses stable token indices for all 189 palette entries. Fonts have one numeric glyph table, fills share one
fully covered texel, and the background reuses one pattern mask in offset color layers over a base fill. Connector
composition from TODO 511 uses these primitives. Projected text cells also pack shape and color into one unsigned
32-bit number, retaining numeric storage without a per-glyph object allocation.

Theme changes upload only the palette and refresh wire colors. Font changes rebuild masks and resolve shape IDs;
pending font work uses the latest palette when installed. Palette memory participates in release, restoration,
replacement, and disposal, and sprite rendering restores texture/sampler bindings after trusted render hooks.

### Validation results

- 1,585 unit tests passed across the affected editor/state/palette/generator/projection/plugins and renderer suites.
- Typechecks passed for all 12 renderer/editor/palette/generator/projection/plugin targets, including plugin test types.
- 44 browser checks passed across the renderer, generator, editor, and six plugins. These include direct pixel checks
  for odd-width R8 rows, transparent/partial coverage, premultiplied RGBA, and palette restoration.
- Generator previews and the expanded all-token text grid were inspected and their intended baselines updated. Existing
  connector, editor, and plugin appearance checks retain their baselines.
- Both `@8f4e/editor-website:build` and `@8f4e/8f4e-website:build` passed.
- Biome checks and whitespace checks passed for changed source files.

### Measurements

Compared the previous implementation at parent revision `4fde9f030` / renderer revision `19dcee23` with the migrated
renderer, using the default `ibmvga8x16` font and palette:

| Resource | Before | After |
| --- | --- | --- |
| Atlas dimensions/format | 1024 x 1024 RGBA8 | 256 x 384 R8 |
| Atlas texel storage | 4,194,304 bytes (4 MiB) | 98,304 bytes (96 KiB) |
| Separate palette storage | None | 756 bytes |
| Unique source rectangles | 4,286 | 130 |
| Rectangle-table texel storage | 34,288 bytes | 1,040 bytes |
| Instance upload | 20 bytes per sprite | 20 bytes per sprite |

Atlas texel storage decreases by 97.7%. These are format byte counts, excluding driver allocation overhead.

A synthetic five-color bitmap-text scene was measured in headless Chrome using ANGLE Metal on an Apple M1 Pro, at
1024 x 768. Each case used 20 warmup frames and the median of 16 measured frames. CPU measurements cover frame
submission; GPU measurements use `EXT_disjoint_timer_query_webgl2`. CPU clock resolution was approximately 0.1 ms.

| Sprites | Before CPU | After CPU | Before GPU | After GPU | Upload / sprite draws |
| --- | --- | --- | --- | --- | --- |
| 10,000 | 0.10 ms | 0.20 ms | 0.185 ms | 0.374 ms | 200,000 bytes / 1 draw in both |
| 50,000 | 0.70 ms | 0.80 ms | 0.415 ms | 0.951 ms | 1,000,000 bytes / 1 draw in both |

The palette lookup adds rendering work in this scene; the result is a memory reduction rather than a measured frame
speedup. These synthetic timings are specific to this machine and do not predict whole-editor FPS. At 1024 x 768,
background composition changes from four large colored tiles to one base fill and 24 pattern instances, adding
420 upload bytes per frame without adding a sprite draw call. Connector instance counts remain three per input and
four per output, as established by TODO 511.

## Related Items

- **Completed prerequisite:** [TODO 511: Compose input and output icons at runtime](511-compose-input-output-icons-at-runtime.md).
  The connector composition is implemented and verified before the R8 and GPU palette migration.
- [TODO 509: Rebuild editor colors from a small base palette](509-rebuild-editor-colors-from-base-palette.md)
- [TODO 504: Add a color-theme contrast audit tool](../504-add-color-theme-contrast-audit-tool.md)
- [TODO 482: Resolve sprite identifiers before drawing](482-resolve-sprite-identifiers-before-drawing.md)
- [TODO 303: Deduplicate font atlas rows for identical text colors](303-dedupe-font-atlas-rows-for-identical-text-colors.md)

## References

- [Current instance buffer](../../../packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/instanceBuffer.ts)
- [Current shaders](../../../packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/shaders.ts)
- [Current font generation](../../../packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/font.ts)
- [Editor color paths](../../../packages/editor/packages/editor-core/docs/color-paths.md)
- [WebGL texture formats](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
