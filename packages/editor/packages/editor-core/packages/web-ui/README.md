# Web UI Package

This package provides a web-based UI renderer for the editor. It renders from the editor state,
web UI render data, and memory views, treating them as immutable inputs. It is designed to be
replaceable by renderers for other platforms.

Rendering is backed by `glugglugglug`. Sprite names are resolved to dense numeric IDs when the atlas is generated, so
per-frame drawers submit positions, sizes, shared shape IDs, and numeric palette indices. WebAssembly RGBA frames are
drawn above the sprites and connection lines. A procedural dotted background runs before the sprite pass.

## Rendering plugins

Web-ui owns its rendering plugins under `src/plugins/`: `background` draws the canvas pattern, `line-drawer` batches
connection wires, and `rgba-texture-layer` draws WebAssembly framebuffer overlays. They depend only on glugglugglug's
`RenderPluginHost` context and hook contract. Glugglugglug owns the sprite renderer; it does not bundle these plugins.

The plugins share shader compilation, required-uniform lookup, render-state setup, and hook removal helpers. Each
plugin owns its resources and destruction. Web-ui initializes background and line rendering, creates texture layers
only for configured overlays, and coordinates memory release and restoration. Backgrounds run in `preDraw`; lines
run in `postDraw`, followed by configured texture overlays.

The background precomposes dot colors over the base when the palette changes and draws one triangle. Each RGBA
overlay owns one texture, uses nearest filtering, and takes opacity from its pixels. Pixel uploads reuse storage
until the image dimensions change; memory release deletes the texture and the next upload recreates it.

## API

### `init(state, renderData, canvas, memoryViews, spriteData, palette, options?)`

Initializes the web UI renderer.

**Parameters:**

- `state: State` - The editor state (read-only)
- `renderData: WebUiRenderDataSource` - Precalculated, web-specific graphic data
- `canvas: HTMLCanvasElement` - The canvas element to render to
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `spriteData: SpriteData` - Pre-generated numeric atlas data from `@8f4e/sprite-generator`
- `palette: ResolvedPalette` - Initial theme resolved separately by `@8f4e/editor-palette`
- `options.onRenderStats` - Optional callback for sampled render statistics
- `options.renderStatsIntervalFrames` - Optional frame interval for `onRenderStats` (defaults to 60)

**Returns:** An object with methods to control the renderer:

- `resize(width, height)` - Resize the canvas
- `loadSpriteAtlas(spriteData)` - Replace font masks and derived drawing data
- `loadPalette(palette)` - Update GPU colors and wire colors without rebuilding masks or lookups
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

### `SpriteData`

Type exported by `@8f4e/sprite-generator` representing sprite sheet data:
```typescript
interface SpriteData {
  spriteAtlas: SpriteAtlas;
  characterWidth: number;
  characterHeight: number;
  backgroundDot: { readonly x: number; readonly y: number; readonly size: number };
}
```

## State Usage

The web-ui package reads from the editor state and render projection but does **not** mutate either. The nested
`@8f4e/web-ui-render-projection` package subscribes to editor state changes and precalculates code-cell shape IDs and palette indices.
Atlas and font changes are explicit and are applied through `loadSpriteAtlas()`. Theme-only changes use `loadPalette()` and retain the atlas and projected glyph IDs. Wire colors are refreshed from
the same resolved palette. `DrawContext.drawFill()` uses the shared fill mask, `drawText()` uses the shared glyph table,
and both accept an explicit palette index. The renderer prepares up to 256 palette colors as premultiplied float32
values in a 4 KiB uniform buffer, while `loadPalette()` continues accepting the resolved editor palette.
Font changes reinstall the glyph table and update character metrics.

Input `[ ]` and output `[*]` connectors are composed at runtime from the shared fill and font sprites. Both use a
three-cell `surfaceRaised2` background; input brackets use `primaryBase`, and output brackets use `secondaryBase`.
The output star selects `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`, `warningBase`, or `negativeBase`
using the existing calibrated value scale. Each input submits three sprites and each output four, in the same sprite
batch. The generator does not prerender connector icons.

Assertion rectangles come from each code block's `widgets.assertions`. They are drawn after code text, covering
the line-number area before the assertion instruction. Passed assertions use `positiveBase`
and failed assertions use `negativeBase`. Hidden previews and disabled blocks omit the markers.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
