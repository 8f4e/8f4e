# Web UI Package

This package provides a web-based UI renderer for the editor. It renders from the editor state,
web UI render data, and memory views, treating them as immutable inputs. It is designed to be
replaceable by renderers for other platforms.

Rendering is backed by `glugglugglug`. Glyph IDs are ASCII character codes 0–127 and fill is 128, so
per-frame drawers submit positions, sizes, shared shape IDs, and numeric palette indices. WebAssembly RGBA frames are
drawn above the sprites and connection lines. A procedural dotted background runs before the sprite pass.

The default framebuffer has no depth buffer; passes use explicit drawing order. Custom raw-context hooks requiring
depth testing must use a framebuffer with their own depth attachment.

## Rendering plugins

Web-ui owns its rendering plugins under `src/plugins/`: `background` draws the canvas pattern and
`rgba-texture-layer` draws WebAssembly framebuffer overlays. They depend only on glugglugglug's `RenderPluginHost`
context and hook contract. Glugglugglug owns the sprite renderer; it does not bundle these plugins.

The plugins share shader compilation, required-uniform lookup, render-state setup, and hook removal helpers. Each
plugin owns its resources and destruction. Web-ui initializes the background, creates texture layers only for
configured overlays, and coordinates memory release and restoration. Backgrounds run in `preDraw`; registered editor
render layers run in `postDraw`, followed by configured texture overlays. The connectors plugin owns all wire
geometry, shaders, buffers, and drawing.

The background precomposes dot colors over the base when the palette changes and draws one triangle. Each RGBA
overlay owns one texture, uses nearest filtering, and takes opacity from its pixels. Pixel uploads reuse storage
until the image dimensions change; memory release deletes the texture and the next upload recreates it.

## API

`createEditorDrawerRegistry()` creates the per-editor registry for code-block drawers, overlays, and canvas-wide
render layers. Pass that registry through `options.drawers` when initializing the renderer.

### `init(state, renderData, canvas, memoryViews, fontAtlas, palette, options?)`

Initializes the web UI renderer.

**Parameters:**

- `state: State` - The editor state (read-only)
- `renderData: WebUiRenderDataSource` - Precalculated, web-specific graphic data
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

The web-ui package reads from the editor state and render projection but does **not** mutate either. The nested
`@8f4e/web-ui-render-projection` package subscribes to editor state changes and precalculates code-cell shape IDs and palette indices.
Atlas and font changes are explicit and are applied through `loadFontAtlas()`. Theme-only changes use `loadPalette()` and retain the atlas and projected glyph IDs. Registered render layers receive the same resolved palette. `DrawContext.drawFill()` uses the shared fill mask, `drawText()` uses fixed ASCII glyph IDs,
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
