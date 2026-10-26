---
title: 'TODO: Add Scientifica font to the editor'
priority: Low
effort: 4-8h
created: 2026-07-30
issue: https://github.com/8f4e/8f4e/issues/953
status: Open
completed: null
---

# TODO: Add Scientifica font to the editor

## Problem Description

The editor sprite-generator has several bundled bitmap fonts, but Scientifica is not currently available for selection. Scientifica is a tall, condensed bitmap font designed for low-DPI displays; most characters are four pixels wide, making it useful for dense code layouts.

Adding it should follow the existing sprite-generator font pipeline instead of introducing a browser font dependency:

- committed source glyph data under `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/`
- generated base64 bitmap metadata under the font's `generated/` directory
- a `Font` union and `FONT_DEFINITIONS` entry so editor config can select it
- third-party font attribution and license tracking

## Proposed Solution

Add the regular Scientifica face as a bundled sprite-generator font, using the local font id `scientifica`.

High-level approach:

- Pin the upstream Scientifica v2.3 release or a newer verified release.
- Import the regular `scientifica-11.bdf` raster source with the existing BDF conversion tool.
- Convert the required editor character set into the sprite-generator source format.
- Configure the background dot position and rectangle size in the font definition; connectors use ordinary bracket/star characters and the shared fill mask.
- Generate the git-ignored bitmap metadata with the existing sprite-generator tooling.
- Register Scientifica in the public font list and lazy metadata loader.
- Update third-party font documentation and commit the SIL Open Font License 1.1 text.

## Implementation Plan

### Step 1: Verify upstream source and license

- Pin an upstream release or commit as the conversion source.
- Confirm the selected release contains the regular `scientifica-11.bdf` source.
- Confirm the BDF character coverage, cell metrics, copyright, and OFL requirements.
- Check whether the upstream license declares any Reserved Font Names that affect the local derived font id.

### Step 2: Add sprite-generator font sources

- Use `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs` to import the regular Scientifica BDF.
- Add `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/scientifica/ascii.ts`.
- Run the existing bitmap generation tool so `generated/ascii.ts` is created.

### Step 3: Register the font

- Add `scientifica` to the `Font` type and `FONT_NAMES`.
- Add a `FONT_DEFINITIONS.scientifica` entry in `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts`.
- Add test fixture coverage for selecting the font through editor configuration.

### Step 4: Document attribution

- Add Scientifica to `packages/editor/THIRD_PARTY_FONTS.md`.
- Add the upstream OFL text under `packages/editor/licenses/`, following the existing font license naming pattern.
- Record the pinned upstream source and note that the committed sprite-generator data is a converted derivative.
- Preserve attribution for Scientifica and the upstream font projects credited by Scientifica.

### Step 5: Validate rendering

- Add or extend tests so `scientifica` loads without falling back to `ibmvga8x16`.
- Add screenshot coverage or manually verify a generated atlas.
- Confirm that the narrow glyph widths, baseline, atlas layout, and lookup coordinates remain stable.
- Check punctuation, bracket/star connector characters, and background dot placement at the intended scale.

## Validation Checkpoints

- `rg -n "scientifica|Scientifica" packages/editor docs/todos`
- `npx nx run sprite-generator:test`
- `npx nx run sprite-generator:typecheck`
- `npx nx run sprite-generator:test:screenshot`

## Success Criteria

- [ ] `scientifica` is selectable as an editor sprite-generator font.
- [ ] The font loads through the same lazy metadata path as existing bundled fonts.
- [ ] ASCII code glyphs render from the regular Scientifica BDF source.
- [ ] Scientifica's condensed metrics render without clipping or incorrect atlas lookups.
- [ ] Connectors and the tiled background render correctly with the new font.
- [ ] Sprite-generator tests, typecheck, and rendering checks pass.
- [ ] Third-party attribution and OFL license text are committed.

## Affected Components

- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/fonts/scientifica/` - new font source and generated bitmap metadata.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/types.ts` - font id registration.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/src/index.ts` - font definition and lazy metadata loader.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs` - BDF conversion path.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tests/` - fixture, selection, and rendering coverage.
- `packages/editor/THIRD_PARTY_FONTS.md` - upstream attribution.
- `packages/editor/licenses/` - Scientifica OFL license text.

## Risks & Considerations

- **Condensed metrics**: Most Scientifica characters are only four pixels wide, so width and padding assumptions in the importer and atlas generator must be verified.
- **Character coverage**: Verify the required ASCII characters, especially brackets and stars used by connectors.
- **Variant scope**: This todo adds the regular face only; bold and italic should use separate font ids and explicit follow-up work if desired.
- **Attribution chain**: Scientifica credits Creep and Lemon as sources for some characters; preserve the relevant upstream attribution.
- **Generated-file churn**: Keep generated bitmap changes limited to the new `scientifica` font directory.
- **Upstream drift**: Pin the source release or commit so regeneration is reproducible.

## Related Items

- **Related**: `docs/todos/388-add-pixelcode-font-to-sprite-generator.md`
- **Related**: `docs/todos/389-add-eaglespcga-alt3-8x8-font-to-sprite-generator.md`
- **Related**: `docs/todos/465-add-sergamon-font-to-editor.md`
- **Related**: `packages/editor/THIRD_PARTY_FONTS.md`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/import-bdf.mjs`
- **Related**: `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/tools/generate-font-bitmaps.mjs`

## References

- [oppiliappan/scientifica](https://github.com/oppiliappan/scientifica)
- [Scientifica v2.3 release](https://github.com/oppiliappan/scientifica/releases/tag/v2.3)
- [Scientifica license](https://github.com/oppiliappan/scientifica/blob/master/LICENSE)

## Notes

- The upstream project describes Scientifica as a tall, condensed bitmap font for geeks.
- The v2.3 release provides BDF, OTB, and TTF formats; the regular BDF is the preferred deterministic import source.
- The upstream project also ships bold and italic faces, which are intentionally outside this todo's scope.
