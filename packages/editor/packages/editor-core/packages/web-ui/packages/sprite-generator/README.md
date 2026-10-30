# Font atlas generation

`@8f4e/sprite-generator` supplies color-independent binary R8 font masks and one solid fill cell.
It returns only `{ image, grid }`. Glyph IDs are ASCII character codes 0–127; the fill ID is 128.
Unsupported characters use the question-mark glyph, ID 63. Every font uses the same IDs, so changing a font
requires no glyph lookup tables or remapping of prepared text cells.

```ts
import loadFontAtlas, { FILL_SPRITE_ID, getGlyphSpriteId } from '@8f4e/sprite-generator';
import { resolvePalette, toPaletteBytes, PALETTE_INDICES } from '@8f4e/editor-palette';
import { Engine } from 'glugglugglug';

const { image, grid } = await loadFontAtlas('ibmvga8x16');
const engine = new Engine(canvas);
engine.setSpriteAtlas(image, grid);
engine.setPalette(toPaletteBytes(resolvePalette()));
engine.renderFrame(() => {
	engine.drawSprite(40, 20, FILL_SPRITE_ID, PALETTE_INDICES.surfaceBase, 200, 100);
	engine.drawSprite(20, 20, getGlyphSpriteId(65), PALETTE_INDICES.inkBase);
});
```

`loadFontAtlas()` defaults to `DEFAULT_FONT`. Each font loads lazily and is decoded and expanded once;
concurrent requests share the same promise. Returned atlases and pixel arrays are cached and shared: treat them
as read-only. No canvas is needed. The default 8×16 font has a 128×144 atlas, with 129 cells on a 16-column grid.
The remaining cells in its last row are transparent.

Font names, cell dimensions, and lazy imports are defined once in `src/fonts/catalog.ts`. `FONT_NAMES` and the
`Font` type come from that catalog. Font sources are ASCII art in `src/fonts/<font>/ascii.ts`: `#` sets a pixel,
and spaces leave it empty. The build packs glyph rows into compact Base64 payloads under `src/generated/`.
These generated modules are ignored by Git. The runtime decoder retains typed arrays for the packed rows.

Import a BDF font with `node tools/import-bdf.mjs <bdf-path> <font-name>`, then register its dimensions and payload
import in the catalog. Web-ui owns font-specific background dot settings in `src/plugins/background/dot-settings.ts`;
configure those there. Backgrounds use a procedural pass, and connectors use ordinary glyphs and fill.

Packed text cells and palette selection belong to `@8f4e/web-ui-render-projection`, separately from font loading.
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
