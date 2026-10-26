---
title: 'TODO: Use glyph masks and a GPU color palette'
priority: Medium
effort: TBD
created: 2026-10-26
issue: null
status: Open
completed: null
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
  palette index, and compose feedback indicators, icons, and other previously prerendered composites at runtime.
- For the background, draw its base fill and reuse the same pattern mask in overlapping instances with different
  palette selections and positional offsets. Do not prerender separate colored versions of the background pattern.

## Implementation Plan

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
- Use a shared opaque mask for solid rectangles. Rework multicolor composite sprites into ordered fills and masks
  composed at runtime so their colors also come from the GPU palette.
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

- [ ] Each glyph shape is stored once, independently of the number of palette colors or shades.
- [ ] The mask atlas uses `R8` storage with one coverage byte per texel, sampled from the red channel.
- [ ] The renderer accepts a generic GPU palette and a palette index per sprite.
- [ ] Editor palette tokens have stable indices across theme changes, including tokens with equal current colors.
- [ ] Sprite instances retain the 20-byte layout, with explicit 16-bit sprite ID and palette index limits.
- [ ] Palette lookup happens in the vertex shader and colors do not require separate draw calls.
- [ ] Palette-only updates refresh all migrated sprite colors without rebuilding or reuploading the atlas.
- [ ] Previously prerendered composites are assembled at runtime; background layers reuse one pattern mask with offsets.
- [ ] Premultiplied alpha, nearest-neighbor bitmap rendering, and compositing order remain correct.
- [ ] Palette resources participate in renderer memory release, restoration, and disposal.
- [ ] Core/plugin consumers use the new APIs and obsolete colored sprite APIs are removed without compatibility shims.
- [ ] Tests and screenshots pass, and atlas memory, submission bandwidth, draw counts, and frame times are compared.

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

## Related Items

- [TODO 509: Rebuild editor colors from a small base palette](archived/509-rebuild-editor-colors-from-base-palette.md)
- [TODO 504: Add a color-theme contrast audit tool](504-add-color-theme-contrast-audit-tool.md)
- [TODO 482: Resolve sprite identifiers before drawing](archived/482-resolve-sprite-identifiers-before-drawing.md)
- [TODO 303: Deduplicate font atlas rows for identical text colors](archived/303-dedupe-font-atlas-rows-for-identical-text-colors.md)

## References

- [Current instance buffer](../../packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/instanceBuffer.ts)
- [Current shaders](../../packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/shaders.ts)
- [Current font generation](../../packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/font.ts)
- [Editor color paths](../../packages/editor/packages/editor-core/docs/color-paths.md)
- [WebGL texture formats](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
