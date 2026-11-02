# Editor Palette

Pure base palette resolution for the editor. This package has no browser, renderer, state, or plugin dependencies.

The default uses Catppuccin Mocha accents with a neutral `#060606` canvas, `#101010` code-block surface, and subdued
comments. Projects can override each shared base color independently; omitted colors retain their default values.
The Catppuccin MIT license notice is retained in `src/palette.ts`.

```ts
import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';

const palette = resolvePalette({ surface: '#1a0b24', ink: '#f6eff8', primary: '#d9a6ff' });
const fill = palette.colors.primaryDark1;
const wire = palette.rgba.strokeBase;
const textColor = PALETTE_INDICES.inkBase;
const gpuColors = toPaletteBytes(palette); // Straight-alpha RGBA8 bytes, four per token.
```

The configurable bases, fixed nine-shade ramps, generic materials, opacity variants, and validation rules are documented in
[the editor palette reference](../../docs/color-paths.md). Resolve a palette during initialization or when configuration
changes. Drawers select stable palette indices and share color-independent glyph/fill masks. The renderer accepts up to
256 such entries and prepares premultiplied colors in a 4 KiB uniform buffer. Equal colors keep distinct indices so a
later theme can give them different values without changing projections.

The implementation keeps the token catalog and base defaults in `palette.ts`, base resolution and shade generation in `resolvePalette.ts`,
and material recipes and contrast selection in `materials.ts`. Color parsing, math, and RGB normalization live in
`color.ts`. Material recipes run in declaration order, after the materials they depend on. Each generated color is
normalized to eight-bit RGB before later recipes use it, preserving the palette values used by the GPU and line rendering.
