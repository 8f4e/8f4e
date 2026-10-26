# Sprite Generator Package

This package generates sprite sheets for the 8f4e editor, containing font glyphs, palette fills, and the background pattern.

## Palette

`generateSprite({ font, palette })` accepts a base palette containing `canvas`, `surface`, `ink`, `primary`, and optional
`muted`, `secondary`, `tertiary`, `highlight`, `detail`, `stroke`, `positive`, `warning`, and `negative` colors.
Omitted values inherit shared defaults. Colors accept hex with optional alpha, `rgb()` / `rgba()`, and `transparent`;
base alpha is preserved in generated shades, with additional fixed 30%, 60%, and 90% opacity variants.
The browser-independent `@8f4e/editor-palette` package resolves predefined Oklab shades, aliases,
and RGBA values before atlas generation. See [the palette reference](../../../../docs/color-paths.md).

Every tonal shade has a fill sprite. The current font catalog contains each base's `Dark2`, `Base`, and `Light2`
variants plus the foreground materials in `FONT_ALIASES` (for example `fontPrimaryDark2` and `fontFloatingInk`).
`primaryDark3` and `primaryDark1` are also available as fonts to preserve the six-step output indicator colors.
Identical font colors share rows, and the atlas layout uses the actual unique row count. No runtime sprite shading is required.
Additional `Alpha30/60/90` swatches are fill-only; source alpha and shared text overlays remain available.
The returned `palette` belongs to the generated atlas and also supplies colors for line rendering.

Input and output connectors are composed by web-ui at runtime from a `surfaceRaised2` fill and ordinary bracket/star
glyphs. The atlas has no dedicated icon or feedback-scale sprites or lookup groups. Fill swatches start beside the
background immediately below the font rows.

## Sprite atlas output

The generator returns a `spriteAtlas` containing the generated `OffscreenCanvas`, one flat deduplicated lookup, and
grouped public numeric identifiers. Resolve those identifiers against the installed atlas to produce dense IDs for
hot-path drawing. Source coordinates are an internal generation detail and are not included in the public result:

```ts
import generateSprite, { resolveSpriteIds } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';

const { spriteAtlas } = await generateSprite({ font: 'ibmvga8x16' });
const engine = new Engine(canvas);

const resolver = engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.lookup);
const spriteIds = resolveSpriteIds(spriteAtlas.spriteIdentifiers, resolver);
engine.renderFrame(() => {
	engine.drawSprite(20, 20, spriteIds.fontInkBase[65]);
	engine.drawSprite(40, 20, spriteIds.fillColors.canvasBase, 200, 100);
});
```

Aliases and semantic roles that refer to the same source rectangle share one public numeric identifier. Callers resolve
the grouped `spriteIdentifiers` against the resolver returned for the installed atlas, retain the resulting `spriteIds`,
and pass those dense ids directly rather than resolving identifiers inside the render loop. Repeat this step whenever
the atlas is replaced.

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
- **sprite-sheet-with-8x16-font** - Default 8x16 font with the standard color scheme
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
