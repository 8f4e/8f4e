# Font atlas generation

`@8f4e/sprite-generator` supplies color-independent binary R8 font masks and one solid fill cell.
It returns only `{ image, grid }`. Glyph IDs are Code page 437 slots 0–255; the fill ID is 256.
`getGlyphSpriteId()` maps Unicode characters to those slots, including CP437's graphical C0 and DEL symbols.
ASCII characters 32–126 keep their character codes as IDs. Unsupported Unicode characters use the question-mark
glyph, ID 63; characters missing from a particular font have blank cells. Every font uses the same IDs, so changing
a font requires no per-font glyph lookup tables or remapping of prepared text cells.

```ts
import loadFontAtlas, { FILL_SPRITE_ID, textToGlyphIds } from '@8f4e/sprite-generator';
import { resolvePalette, toPaletteBytes, PALETTE_INDICES } from '@8f4e/editor-palette';
import { Engine } from 'glugglugglug';

const { image, grid } = await loadFontAtlas('ibmvga8x16');
const engine = new Engine(canvas);
engine.setSpriteAtlas(image, grid);
engine.setPalette(toPaletteBytes(resolvePalette()));
const [letterA] = textToGlyphIds('A');
engine.renderFrame(() => {
	engine.drawSprite(40, 20, FILL_SPRITE_ID, PALETTE_INDICES.surfaceBase, 200, 100);
	engine.drawSprite(20, 20, letterA, PALETTE_INDICES.inkBase);
});
```

`textToGlyphIds()` is pure and has no cache. Call it only during preparation, outside drawers and render callbacks.
The owning plugin's existing preparator retains the IDs until its text or layout changes. Glyph IDs are shared by
all fonts, so font switches do not require remapping prepared text.

`loadFontAtlas()` defaults to `DEFAULT_FONT`. Each font loads lazily and is decoded and expanded once;
concurrent requests share the same promise. Returned atlases and pixel arrays are cached and shared: treat them
as read-only. No canvas is needed. The default 8×16 font has a 128×272 atlas, with 257 cells on a 16-column grid.
The remaining cells in its last row are transparent.

Font names, cell dimensions, and lazy imports are defined once in `src/fonts/catalog.ts`. `FONT_NAMES` and the
`Font` type come from that catalog. Font sources are ASCII art in `src/fonts/<font>/ascii.ts`: `#` sets a pixel,
and spaces leave it empty. Each source has 256 glyphs in the shared CP437 display order defined in
`src/characterSet.ts`. The build packs glyph rows into compact Base64 payloads under `src/generated/`.
These generated modules are ignored by Git. The runtime decoder retains typed arrays for the packed rows.

Import a BDF font with `node tools/import-bdf.mjs <bdf-path> <font-name>`, then register its dimensions and payload
import in the catalog. The importer maps Unicode BDF encodings to CP437 and accepts BDFs explicitly marked
`CHARSET_REGISTRY "ibm"` and `CHARSET_ENCODING "437"` in slot order. Missing characters and the NUL slot stay blank.
Web-ui owns font-specific background dot settings in `src/plugins/background/dot-settings.ts`;
configure those there. Backgrounds use a procedural pass, and connectors use ordinary glyphs and fill.

Pixel-outline TTF/OTF fonts can first be converted to BDF with `tools/import-pixel-outline.py`. This optional
import tool requires Python's `fontTools` package; production builds use only the committed ASCII sources.
It samples the original design-pixel grid without antialiasing. The caller supplies that grid and the fixed-cell
metrics. For the two Star Trek fonts, run from this package directory:

```sh
python3 tools/import-pixel-outline.py star-trek-25th-anniversary.otf startrek25th8x9.bdf --units-per-pixel 250 --width 8 --height 9 --ascent 7
node tools/import-bdf.mjs startrek25th8x9.bdf startrek25th8x9
python3 tools/import-pixel-outline.py DilithiumPixelsNbpRegular-B5jd.ttf dilithiumpixels7x10.bdf --units-per-pixel 64 --width 7 --height 10 --ascent 10
node tools/import-bdf.mjs dilithiumpixels7x10.bdf dilithiumpixels7x10
node tools/import-bdf.mjs DepartureMono14-Regular.bdf departuremono7x14
```

The font origins, download versions, checksums, and licenses are recorded in
[Third-Party Fonts](../../../../THIRD_PARTY_FONTS.md). Missing CP437 glyphs in these fonts remain blank.

Code text preparation and syntax palette selection belong to `@8f4e/editor-plugin-code-rendering`. Web-ui owns the
generic packed sprite-cell format, separately from font loading.
Themes are resolved through `@8f4e/editor-palette` and never change mask pixels.

From the repository root:

```sh
npx nx run @8f4e/sprite-generator:generate-fonts
npx nx run @8f4e/sprite-generator:build
npx nx run @8f4e/sprite-generator:test
npx nx run @8f4e/sprite-generator:typecheck
npx nx run @8f4e/sprite-generator:test:screenshot
```

Unit tests compare every glyph pixel against its ASCII source for every bundled font, verify fill and unused cells,
and check packed-row decoding, fallback IDs, and cached loading. Browser snapshots cover mask previews, renderer
integration, and example palettes. Update snapshots only for intentional visual changes with
`npx nx run @8f4e/sprite-generator:test:screenshot:update`.

Browser checks start their own Vite preview server at `http://localhost:3102`, separate from the metrics dashboard
on port 3002. The port is bound strictly and existing servers are never reused. Tests navigate relative to the
configured base URL and wait for the preview page's `data-ready` signal before capturing images. Playwright
launches Vite directly and stops it after the run.
