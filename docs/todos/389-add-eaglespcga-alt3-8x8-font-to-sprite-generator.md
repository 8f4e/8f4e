---
title: 'TODO: Add EagleSpCGA Alt3 8x8 font to sprite-generator'
priority: Low
effort: 4-8h
created: 2026-05-04
issue: https://github.com/8f4e/8f4e/issues/651
status: Open
completed: null
---

# TODO: Add EagleSpCGA Alt3 8x8 font to sprite-generator

## Problem Description

The editor sprite-generator has several bundled bitmap fonts, including a few compact 8-pixel-high options, but it does not include EagleSpCGA Alt3 8x8. That leaves the editor without this CGA-style 8x8 option for dense code and retro display experiments.

Adding it should follow the existing sprite-generator font pipeline instead of introducing a browser font dependency:

- committed source glyph data under `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/`
- generated base64 bitmap metadata under the font's `generated/` directory
- a `Font` union and `FONT_DEFINITIONS` entry so editor config can select it
- third-party font attribution and license tracking

## Proposed Solution

Add EagleSpCGA Alt3 8x8 as a bundled sprite-generator font, using a local derived font id such as `eaglespcgaalt38x8`.

High-level approach:

- Locate the authoritative EagleSpCGA Alt3 8x8 source font file and prefer BDF or another deterministic bitmap source when available.
- Confirm the upstream license and attribution requirements before committing converted glyph data.
- Convert the ASCII glyphs into the sprite-generator source format used by the existing fonts.
- Configure the background dot position and rectangle size in the font definition; connectors use ordinary bracket/star characters and the shared fill mask.
- Generate the git-ignored bitmap metadata with the existing sprite-generator tooling.
- Register the font in the sprite-generator public font list and lazy metadata loader.
- Update third-party font documentation and commit required license text.

## Implementation Plan

### Step 1: Verify upstream source and license

- Find the authoritative EagleSpCGA Alt3 8x8 source file.
- Confirm the upstream license, copyright, and attribution requirements.
- Check whether the upstream naming has restrictions that affect the local derived font id.

### Step 2: Add sprite-generator font sources

- Add `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/eaglespcgaalt38x8/ascii.ts`.
- Use `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs` if the upstream source is BDF.
- Run the existing bitmap generation tool so `generated/ascii.ts` is created.

### Step 3: Register the font

- Add `eaglespcgaalt38x8` to the `Font` type and `FONT_NAMES`.
- Add a `FONT_DEFINITIONS.eaglespcgaalt38x8` entry in `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts`.
- Add test fixture coverage for the new font configuration.

### Step 4: Document attribution

- Add EagleSpCGA Alt3 8x8 to `packages/editor/THIRD_PARTY_FONTS.md`.
- Add the upstream license text under `packages/editor/licenses/`, following the existing font license file naming pattern.
- Note that the committed sprite-generator font data is a converted derivative.

### Step 5: Validate rendering

- Add or extend tests so `eaglespcgaalt38x8` can be selected and loaded without falling back to `ibmvga8x16`.
- Add screenshot coverage or manually verify a generated atlas using the new font.
- Check that glyph dimensions, atlas layout, and lookup coordinates stay stable for an 8x8 font.

## Validation Checkpoints

- `rg -n "eaglespcga|EagleSpCGA|Alt3" packages/editor docs/todos`
- `npx nx run sprite-generator:test`
- `npx nx run sprite-generator:typecheck`
- `npx nx run sprite-generator:test:screenshot`

## Success Criteria

- [ ] `eaglespcgaalt38x8` is a selectable sprite-generator font.
- [ ] The font loads through the same lazy metadata path as existing bundled fonts.
- [ ] ASCII code glyphs render from EagleSpCGA Alt3 8x8-derived data.
- [ ] Connectors and the tiled background render correctly with the new font.
- [ ] Sprite-generator tests and typecheck pass.
- [ ] Third-party font attribution and license text are committed.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/eaglespcgaalt38x8/` - new font source and generated bitmap metadata.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/types.ts` - font id registration.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts` - font definition and lazy metadata loader.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tests/` - fixture and font selection coverage.
- `packages/editor/THIRD_PARTY_FONTS.md` - upstream attribution.
- `packages/editor/licenses/` - EagleSpCGA Alt3 8x8 license text.

## Risks & Considerations

- **Source authority**: EagleSpCGA variants may be mirrored in multiple archives, so choose a clear upstream source and record it.
- **License clarity**: Do not commit converted glyph data until the license and redistribution terms are verified.
- **Glyph dimensions**: Confirm the imported glyphs are true 8x8 bitmaps and do not rely on extra ascent/descent padding.
- **Generated-file churn**: Keep generated bitmap updates limited to the new `eaglespcgaalt38x8` font directory.

## Related Items

- **Related**: `docs/todos/388-add-pixelcode-font-to-sprite-generator.md`
- **Related**: `packages/editor/THIRD_PARTY_FONTS.md`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/generate-font-bitmaps.mjs`

## References

- Add the authoritative EagleSpCGA Alt3 8x8 upstream source URL during implementation.
- Add the authoritative license URL during implementation.

## Notes

- Keep the local font id lowercase and consistent with the existing sprite-generator font directory naming style.
