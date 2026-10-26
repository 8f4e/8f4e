---
title: 'TODO: Add Sergamon font to the editor'
priority: Low
effort: 4-8h
created: 2026-07-30
issue: https://github.com/8f4e/8f4e/issues/952
status: Open
completed: null
---

# TODO: Add Sergamon font to the editor

## Problem Description

The editor sprite-generator has several bundled bitmap fonts, but Sergamon is not currently available for selection. Sergamon is a monospaced programming font whose glyphs are designed on an 8x16 pixel grid, making it a natural fit for the editor's bitmap font pipeline.

Adding it should follow the existing sprite-generator font pipeline instead of introducing a browser font dependency:

- committed source glyph data under `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/`
- generated base64 bitmap metadata under the font's `generated/` directory
- a `Font` union and `FONT_DEFINITIONS` entry so editor config can select it
- third-party font attribution and license tracking

## Proposed Solution

Add Sergamon as a bundled sprite-generator font, using the local font id `sergamon`.

High-level approach:

- Import the upstream plain-text `.glyph` sources, which describe glyphs directly on an 8x16 pixel grid.
- Convert the required editor character set into the sprite-generator source format.
- Configure the background dot position and rectangle size in the font definition; connectors use ordinary bracket/star characters and the shared fill mask.
- Generate the git-ignored bitmap metadata with the existing sprite-generator tooling.
- Register Sergamon in the public font list and lazy metadata loader.
- Update third-party font documentation and commit the SIL Open Font License 1.1 text.

## Implementation Plan

### Step 1: Verify upstream source and license

- Pin an upstream Sergamon release or commit as the conversion source.
- Confirm that the `.glyph` files cover the editor's required ASCII characters.
- Check the OFL license for Reserved Font Name restrictions that affect the local derived font name.

### Step 2: Add sprite-generator font sources

- Add `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/sergamon/ascii.ts`.
- Add or adapt an import tool that converts Sergamon's `.glyph` format deterministically.
- Run the existing bitmap generation tool so `generated/ascii.ts` is created.

### Step 3: Register the font

- Add `sergamon` to the `Font` type and `FONT_NAMES`.
- Add a `FONT_DEFINITIONS.sergamon` entry in `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts`.
- Add test fixture coverage for selecting the font through editor configuration.

### Step 4: Document attribution

- Add Sergamon to `packages/editor/THIRD_PARTY_FONTS.md`.
- Add the upstream OFL text under `packages/editor/licenses/`, following the existing font license naming pattern.
- Record the pinned upstream source and note that the committed sprite-generator data is a converted derivative.

### Step 5: Validate rendering

- Add or extend tests so `sergamon` loads without falling back to `ibmvga8x16`.
- Add screenshot coverage or manually verify a generated atlas.
- Confirm the glyph dimensions, baseline, atlas layout, and lookup coordinates remain stable.
- Verify that the font is rendered without synthesized bold, matching Sergamon's single-weight design.

## Validation Checkpoints

- `rg -n "sergamon|Sergamon" packages/editor docs/todos`
- `npx nx run sprite-generator:test`
- `npx nx run sprite-generator:typecheck`
- `npx nx run sprite-generator:test:screenshot`

## Success Criteria

- [ ] `sergamon` is selectable as an editor sprite-generator font.
- [ ] The font loads through the same lazy metadata path as existing bundled fonts.
- [ ] ASCII code glyphs render from Sergamon-derived 8x16 data.
- [ ] Connectors and the tiled background render correctly with the new font.
- [ ] Sprite-generator tests, typecheck, and rendering checks pass.
- [ ] Third-party attribution and OFL license text are committed.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/sergamon/` - new font source and generated bitmap metadata.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/types.ts` - font id registration.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts` - font definition and lazy metadata loader.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/` - deterministic Sergamon glyph importer.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tests/` - fixture, selection, and rendering coverage.
- `packages/editor/THIRD_PARTY_FONTS.md` - upstream attribution.
- `packages/editor/licenses/` - Sergamon OFL license text.

## Risks & Considerations

- **Character coverage**: Confirm the editor-required character set and verify the ordinary bracket/star characters used by connectors.
- **Font naming**: Respect any Reserved Font Name declarations when naming converted or modified assets.
- **Single weight**: Do not synthesize a bold variant; Sergamon intentionally provides one weight.
- **Generated-file churn**: Keep generated bitmap changes limited to the new `sergamon` font directory.
- **Upstream drift**: Pin the source release or commit so regeneration is reproducible.

## Related Items

- **Related**: `docs/todos/388-add-pixelcode-font-to-sprite-generator.md`
- **Related**: `docs/todos/389-add-eaglespcga-alt3-8x8-font-to-sprite-generator.md`
- **Related**: `packages/editor/THIRD_PARTY_FONTS.md`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/generate-font-bitmaps.mjs`

## References

- [Sergamon website](https://sgmonda.com/sergamon/)
- [sgmonda/sergamon](https://github.com/sgmonda/sergamon)
- [Sergamon license](https://github.com/sgmonda/sergamon/blob/main/LICENSE)

## Notes

- Sergamon describes itself as a pixel-perfect monospaced font for code.
- The upstream project provides more than 4,000 glyphs on an 8x16 pixel grid with no ligatures.
- The upstream font and glyph sources are licensed under SIL Open Font License 1.1.
