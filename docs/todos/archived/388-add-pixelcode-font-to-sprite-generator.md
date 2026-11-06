---
title: 'TODO: Add PixelCode font to sprite-generator'
priority: Low
effort: 4-8h
created: 2026-05-02
issue: https://github.com/8f4e/8f4e/issues/650
status: Completed
completed: 2026-11-06
---

# TODO: Add PixelCode font to sprite-generator

Completed on 2026-11-06 as `pixelcode6x12`: PixelCode 6×12, imported from the pinned regular v2.2 outline at its original 112-unit pixel grid. The font is registered in the shared lazy catalog with all 256 CP437 slots; missing source glyphs remain blank. Source pixels, atlas addressing, and background rendering were verified, and unit tests, type checks, and browser rendering checks pass. Attribution and the upstream license are recorded in `packages/editor/packages/editor-core/THIRD_PARTY_FONTS.md`. The plan below records the original proposal.

## Problem Description

The editor sprite-generator has several bundled bitmap fonts, but it does not include PixelCode/Pixel Code. PixelCode is an upstream pixel font aimed at programming, which makes it a good candidate for the code-heavy 8f4e editor surface.

Adding it should follow the existing sprite-generator font pipeline instead of introducing a browser font dependency:

- committed source glyph data under `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/`
- generated Base64 bitmap metadata under `src/generated/`
- a shared font catalog entry so editor config can select it
- third-party font attribution and license tracking

## Proposed Solution

Add PixelCode as a bundled sprite-generator font, using a local derived font id such as `pixelcode6x12`.

High-level approach:

- Pull the current upstream PixelCode release/source from `https://github.com/qwerasd205/PixelCode`.
- Confirm the available source format in the upstream `dist/` or `src/` directories.
- Convert the ASCII glyphs into the sprite-generator source format used by the existing fonts.
- Configure background dot placement in web-ui's `src/plugins/background/dot-settings.ts`; connectors use ordinary bracket/star characters and the shared fill mask.
- Generate the git-ignored bitmap metadata with the existing sprite-generator tooling.
- Register the font in the sprite-generator public font list and lazy metadata loader.
- Update third-party font documentation and commit the OFL license text.

## Implementation Plan

### Step 1: Verify upstream source and license

- Inspect the upstream release/source files and choose the most deterministic conversion input.
- Confirm the upstream license is SIL Open Font License 1.1.
- Check whether the upstream font declares any Reserved Font Name restrictions that affect the local derived font id.

### Step 2: Add sprite-generator font sources

- Add `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/pixelcode6x12/ascii.ts`.
- Run the existing bitmap generation tool so `src/generated/<font>.ts` is created.

### Step 3: Register the font

- Add `pixelcode6x12` to the font catalog; `Font` and `FONT_NAMES` are derived from it.
- Add a `FONTS.pixelcode6x12` entry in `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/catalog.ts`.
- Add test fixture coverage for the new font configuration.

### Step 4: Document attribution

- Add PixelCode to `packages/editor/packages/editor-core/THIRD_PARTY_FONTS.md`.
- Add the upstream OFL text under `packages/editor/packages/editor-core/licenses/`, following the existing font license file naming pattern.
- Note that the committed sprite-generator font data is a converted derivative.

### Step 5: Validate rendering

- Add or extend tests so `pixelcode6x12` can be selected and loaded without falling back to `ibmvga8x16`.
- Add screenshot coverage or manually verify a generated atlas using the new font.
- Check that glyph dimensions, atlas layout, and lookup coordinates stay stable.

## Validation Checkpoints

- `rg -n "pixelcode|PixelCode|Pixel Code" packages/editor docs/todos`
- `npx nx run @8f4e/sprite-generator:test`
- `npx nx run @8f4e/sprite-generator:typecheck`
- `npx nx run @8f4e/sprite-generator:test:screenshot`

## Success Criteria

- [x] `pixelcode6x12` is a selectable sprite-generator font.
- [x] The font loads through the same lazy metadata path as existing bundled fonts.
- [x] ASCII code glyphs render from PixelCode-derived data.
- [x] Connectors and the tiled background render correctly with the new font.
- [x] Sprite-generator tests and typecheck pass.
- [x] Third-party font attribution and OFL license text are committed.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/pixelcode6x12/` - new font source.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/catalog.ts` - font dimensions, lazy payload import, and derived font-name types.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tests/` - fixture and font selection coverage.
- `packages/editor/packages/editor-core/THIRD_PARTY_FONTS.md` - upstream attribution.
- `packages/editor/packages/editor-core/licenses/` - PixelCode OFL license text.

## Risks & Considerations

- **Source format mismatch**: PixelCode may not ship BDF directly, so conversion may require an extra deterministic step from TTF/OTF/source data.
- **Glyph dimensions**: Variable glyph metrics or unexpected bounding boxes need to be normalized to the fixed-width sprite-generator model.
- **Reserved font names**: OFL derivatives must respect any upstream Reserved Font Name declarations.
- **Generated-file churn**: Keep generated bitmap updates limited to the new `pixelcode6x12` font directory.

## Related Items

- **Related**: `packages/editor/packages/editor-core/THIRD_PARTY_FONTS.md`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/generate-font-bitmaps.mjs`

## References

- [qwerasd205/PixelCode](https://github.com/qwerasd205/PixelCode)
- [PixelCode README](https://raw.githubusercontent.com/qwerasd205/PixelCode/main/README.md)
- [PixelCode license](https://raw.githubusercontent.com/qwerasd205/PixelCode/main/LICENSE)

## Notes

- The upstream repository describes Pixel Code as a pixel font for programming.
- The upstream repository currently reports OFL-1.1 licensing.
