# Web UI Package

This package provides a web-based UI renderer for the editor. It renders from the editor state and memory views, treating them as immutable inputs. It is designed to be
replaceable by renderers for other platforms.

Rendering is backed by `glugglugglug`. Glyph IDs are ASCII character codes 0–127 and fill is 128, so
per-frame drawers submit positions, sizes, shared shape IDs, and numeric palette indices. Plugins can register canvas-wide GPU passes above the sprites. A procedural dotted background runs before the sprite pass.

The default framebuffer has no depth buffer; passes use explicit drawing order. Custom raw-context hooks requiring
depth testing must use a framebuffer with their own depth attachment.

## Rendering plugins

Web-ui owns the procedural background under `src/plugins/background`. It precomposes dot colors over the base
when the palette changes and draws one triangle before sprites. Glugglugglug owns sprite rendering.

Canvas-wide editor layers run after sprites in registration order and before render statistics are sampled.
Web-ui supplies shader helpers and forwards palette changes, memory release, and disposal. The connectors plugin
owns wires; `@8f4e/editor-plugin-texture-runtime` owns block-bound framebuffer views in the overlay, their optional WASM execution, and shared GPU resources.

## API

`createEditorDrawerRegistry()` creates the per-editor registry for code-block content drawers, drawers, overlays, and canvas-wide
render layers. Pass that registry through `options.drawers` when initializing the renderer.

### `init(state, canvas, memoryViews, fontAtlas, palette, options?)`

Initializes the web UI renderer.

**Parameters:**

- `state: State` - The editor state (read-only)
- `canvas: HTMLCanvasElement` - The canvas element to render to
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `fontAtlas: FontAtlas` - Cached font masks and grid dimensions from `@8f4e/sprite-generator`
- `palette: ResolvedPalette` - Initial theme resolved separately by `@8f4e/editor-palette`
- `options.onRenderStats` - Optional callback for sampled render statistics
- `options.renderStatsIntervalFrames` - Optional frame interval for `onRenderStats` (defaults to 60)

**Returns:** An object with methods to control the renderer:

- `resize(width, height)` - Resize the canvas
- `loadFontAtlas(fontAtlas, font)` - Replace font masks and derived drawing data
- `loadPalette(palette)` - Update GPU colors and notify render layers without rebuilding masks
- `renderFrame()` - Draw one frame on demand
- `destroy()` - Release renderer and plugin resources

### `RenderStats`

Type emitted by `options.onRenderStats`:
```typescript
interface RenderStats {
  timeToRenderMs: number;
  fps: number; // Calculated over the sampled frame interval
  frameBudgetMs: number;
  headroomMs: number;
  fpsCapacity: number;
  spriteCount: number;
  uploadedInstanceBytes: number;
}
```

### `FontAtlas`

Type exported by `@8f4e/sprite-generator` representing a font atlas:
```typescript
interface FontAtlas {
  image: SpriteAtlasImage;
  grid: SpriteAtlasGrid;
}
```

## State Usage

The web-ui package reads editor state without mutating it. `@8f4e/editor-plugin-code-rendering` owns code text,
syntax highlighting, and its private cache of prepared sprite cells. It registers a content drawer through
`registerCodeBlockContentDrawer()`, which runs after block backgrounds and highlights, before the cursor,
shape declarations, diagnostics, ordinary block drawers, and overlays. Without a content plugin, blocks retain
their backgrounds and editing affordances while no source text is drawn.

Atlas and font changes are explicit and are applied through `loadFontAtlas()`. Theme-only changes use `loadPalette()` and retain the atlas and prepared glyph IDs. Registered render layers receive the same resolved palette. `DrawContext.drawFill()` uses the shared fill mask, `drawText()` uses fixed ASCII glyph IDs,
and both accept an explicit palette index. The renderer prepares up to 256 palette colors as premultiplied float32
values in a 4 KiB uniform buffer, while `loadPalette()` continues accepting the resolved editor palette.
The editor installs font grid dimensions into state before initializing or updating the view.
Font changes replace the masks and update drawing metrics. Dot positions and sizes live beside the background plugin
in `src/plugins/background/dot-settings.ts`; no background settings come from the font atlas.

Input/output connector sprites and wires belong to `@8f4e/editor-plugin-connectors`.

`@8f4e/editor-plugin-assertion-markers` uses the generic code-block drawer hook to draw passed/failed assertion
indicators after source text. The renderer has no assertion-specific drawer or marker fields.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
