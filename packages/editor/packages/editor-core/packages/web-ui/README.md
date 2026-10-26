# Web UI Package

This package provides a web-based UI renderer for the editor. It renders from the editor state,
web UI render data, and memory views, treating them as immutable inputs. It is designed to be
replaceable by renderers for other platforms.

Rendering is backed by `glugglugglug`. Sprite names are resolved to dense numeric IDs when the atlas is generated, so
per-frame drawers submit only positions, sizes, and numeric IDs. WebAssembly RGBA frames are
drawn below the sprites, while connections are drawn as a line overlay above them.

## API

### `init(state, renderData, canvas, memoryViews, spriteData, options?)`

Initializes the web UI renderer.

**Parameters:**

- `state: State` - The editor state (read-only)
- `renderData: WebUiRenderDataSource` - Precalculated, web-specific graphic data
- `canvas: HTMLCanvasElement` - The canvas element to render to
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `spriteData: SpriteData` - Pre-generated numeric atlas data from `@8f4e/sprite-generator`
- `options.onRenderStats` - Optional callback for sampled render statistics
- `options.renderStatsIntervalFrames` - Optional frame interval for `onRenderStats` (defaults to 60)

**Returns:** An object with methods to control the renderer:

- `resize(width, height)` - Resize the canvas
- `loadSpriteAtlas(spriteData)` - Replace the atlas and its derived drawing data
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

Type representing sprite sheet data:
```typescript
interface SpriteData {
  spriteAtlas: SpriteAtlas<SpriteIdLookups>;
  characterWidth: number;
  characterHeight: number;
}
```

## State Usage

The web-ui package reads from the editor state and render projection but does **not** mutate either. The nested
`@8f4e/web-ui-render-projection` package subscribes to editor state changes and precalculates code-cell sprite IDs.
Atlas and font changes are explicit and are applied through `loadSpriteAtlas()`. Wire colors are resolved from the
current editor color scheme when the atlas is loaded.

Assertion rectangles come from each code block's `widgets.assertions`. They are drawn after code text, covering
the line-number area before the assertion instruction. Passed assertions use `color.positive`
and failed assertions use `color.negative`. Hidden previews and disabled blocks omit the markers.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
