# Sprite Generator Package

This package generates sprite sheets for the 8f4e editor, containing color-independent R8 font glyphs, a shared fill mask, and the background pattern.

## Palette

`generateSprite({ font })` returns only masks, source identifiers, and font metrics. Resolve themes separately with
`@8f4e/editor-palette`, which owns predefined shades, semantic aliases, alpha, and RGBA values.
See [the palette reference](../../../../docs/color-paths.md).

Every palette token can color any glyph or fill, including opacity variants. `PALETTE_INDICES` gives tokens stable
numeric indices across theme changes; equal colors retain different indices. `toPaletteBytes(palette)` encodes the
resolved colors as a straight-alpha RGBA8 table for the generic renderer.

## Sprite atlas output

The generator returns a `spriteAtlas` with `image: { width, height, data }`, where `data` is a tightly packed `Uint8Array`
of R8 coverage. It contains one set of 128 glyphs keyed by numeric character code, a shared one-pixel fill, and one
background pattern mask. There are 130 unique source rectangles, independently of the selected theme. No canvas is
needed to generate these resources.

Resolve the public IDs (`font` glyph table, `fill`, and `background`) against the installed atlas before drawing:

```ts
import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import generateSprite, { resolveSpriteIds } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';

const { spriteAtlas } = await generateSprite({ font: 'ibmvga8x16' });
const palette = resolvePalette();
const engine = new Engine(canvas);
const resolver = engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.lookup);
const ids = resolveSpriteIds(spriteAtlas.spriteIdentifiers, resolver);
engine.setPalette(toPaletteBytes(palette));
engine.renderFrame(() => {
	engine.drawSprite(40, 20, ids.fill, PALETTE_INDICES.surfaceBase, 200, 100);
	engine.drawSprite(20, 20, ids.font[65], PALETTE_INDICES.inkBase);
});
```

A theme change only needs `engine.setPalette(toPaletteBytes(resolvePalette(config)))`; the mask pixels and source
rectangles stay unchanged. Replace and resolve the atlas when font shapes or dimensions change.

Input and output connectors are composed at runtime from fills and ordinary bracket/star glyphs. The background uses
one base fill and the same pattern mask drawn in two colors, with the second instance offset horizontally by one
character cell. Tiling keeps both layers aligned without submitting one instance per dot.

## Font Bitmaps

Font bitmaps are precomputed from ASCII art sources and bundled as Base64-encoded payloads to reduce bundle size and eliminate runtime conversion overhead.

### Editing Fonts

Font glyphs are defined as ASCII art in the source files:

- `src/fonts/ibmvga8x16/ascii.ts` - 8x16 ASCII character font
- `src/fonts/ibmvga8x16/glyphs.ts` - 8x16 custom glyphs for UI elements
- `src/fonts/6x10/ascii.ts` - 6x10 ASCII character font
- `src/fonts/6x10/glyphs.ts` - 6x10 custom glyphs for UI elements

Each glyph is an array of strings where:
- `' '` (space) represents an unset pixel
- `'#'` represents a set pixel

Example:
```typescript
[ // Character 'A'
	'   #    ',
	'  ###   ',
	' ## ##  ',
	'##   ## ',
	'####### ',
	'##   ## ',
	'##   ## ',
]
```

### Regenerating Font Bitmaps

Font bitmaps are automatically regenerated as part of the build process. However, you can manually regenerate them:

```bash
# From the sprite-generator package directory
node tools/generate-font-bitmaps.mjs

# Or using Nx
npx nx run @8f4e/sprite-generator:generate-fonts
```

Generated files are located in:
- `src/fonts/ibmvga8x16/generated/`
- `src/fonts/6x10/generated/`

These files are git-ignored and should not be committed.

### How It Works

1. **Build Time**: The `generate-font-bitmaps.mjs` tool reads ASCII art font definitions and converts them to numeric bitmaps.
2. **Encoding**: Numeric bitmaps are encoded as Base64 strings with metadata (character dimensions, glyph count).
3. **Runtime**: The `font-decoder.ts` utility decodes Base64 payloads back to numeric arrays for rendering.

This approach reduces the production bundle size by ~90% compared to shipping ASCII art sources.

## Development

```bash
# Build the package
npx nx run @8f4e/sprite-generator:build

# Run tests
npx nx run @8f4e/sprite-generator:test

# Type check
npx nx run @8f4e/sprite-generator:typecheck

# Development mode with watch
npx nx run @8f4e/sprite-generator:dev
```

## Visual Regression Testing

The sprite generator includes Playwright-driven screenshot tests to ensure visual consistency and catch rendering regressions early.

### Prerequisites

Before running screenshot tests, ensure the sprite-generator package is built:

```bash
# Build the package (required for Vite aliases to resolve)
npx nx run @8f4e/sprite-generator:build
```

### Running Screenshot Tests

```bash
# Run all screenshot tests
npx nx run @8f4e/sprite-generator:test:screenshot

# Run with UI mode for debugging
npx nx run @8f4e/sprite-generator:test:screenshot:ui

# Run in headed mode (visible browser)
npx nx run @8f4e/sprite-generator:test:screenshot:headed

# Debug tests step-by-step
npx nx run @8f4e/sprite-generator:test:screenshot:debug
```

### Updating Snapshots

When sprite rendering changes are intentional (e.g., new features or bug fixes), update the baseline snapshots:

```bash
# Update all snapshots
npx nx run @8f4e/sprite-generator:test:screenshot:update
```

### Test Structure

Screenshot tests are located in `screenshot-tests/`:
- `screenshot.test.ts` - Main Playwright test file
- `test-cases/` - HTML and TypeScript files for each test scenario
- `screenshot.test.ts-snapshots/` - Baseline snapshot images (committed to git)
- `vite.config.ts` - Vite configuration for the test server (port 3002)

### Test Cases

Current test scenarios include:
- **sprite-sheet-with-8x16-font** - R8 masks for the default 8x16 font
- **sprite-sheet-with-6x10-font** - Sprite sheet generated with the 6x10 font
- **sprite-atlas** - Generated flat lookup and numeric IDs rendered through the WebGL engine

### Adding New Test Cases

1. Create a new HTML file in `screenshot-tests/test-cases/` (e.g., `my-test.html`)
2. Create a corresponding TypeScript file (e.g., `my-test.ts`)
3. Add the test case name to the `testCases` array in `screenshot.test.ts`
4. Run `npx nx run @8f4e/sprite-generator:test:screenshot:update` to capture the baseline snapshot

### CI Integration

Screenshot tests run automatically in CI. If a test fails:
1. Review the diff in the CI output
2. If the change is intentional, update snapshots locally and commit
3. If the change is unintentional, fix the rendering issue

## Bundle Size

Font bitmaps before optimization: ~79KB
Font bitmaps after optimization: ~8KB (90% reduction)
