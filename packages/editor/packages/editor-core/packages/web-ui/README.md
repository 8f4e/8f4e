# Web UI Package

This package provides the browser renderer for the editor. It owns font and color configuration, font atlas loading,
and palette updates. Drawing reads editor state and memory views; font changes update the shared layout grid.
It is designed to be replaceable by renderers for other platforms.

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

### `registerModalOverlay(drawer)`

Registers a viewport-coordinate sprite drawer after menus and ordinary canvas overlays. This stage runs even
when `featureFlags.canvasOverlays` is false. The callback receives `{ draw, state, memoryViews }` and registration
returns an unregister function. `@8f4e/editor-plugin-dialogs` owns dialog layout and drawing through this hook;
web-ui contains no dialog-specific rendering.

### `registerWebUiConfig(store)`

Registers schema-backed validators for `; @config font <name>` and `; @config color.<base> <value>` in the shared
configuration registry. Editor-core calls this before installing plugins and loading the initial project.
Editor-state parses and resolves configuration generically; web-ui owns supported fonts, color validation, and defaults.

### `init(store, events, canvas, memoryViews, options?)`

Initializes the web UI renderer without drawing or scheduling frames. Editor-core owns the frame loop.

**Parameters:**

- `store: StateManager<State>` - Editor state and configuration subscriptions
- `events: EventDispatcher` - Announces layout grid size changes
- `canvas: HTMLCanvasElement` - The canvas element to render to
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `options.onRenderStats` - Optional callback for sampled render statistics
- `options.renderStatsIntervalFrames` - Optional frame interval for `onRenderStats` (defaults to 60)

**Returns:** An object with methods to control the renderer:

- `resize(width, height)` - Resize the canvas
- `renderFrame()` - Restore released GPU resources as needed and draw one frame from the supplied state
- `releaseRenderingResources()` - Release reloadable GPU resources and the canvas drawing buffer
- `resetRenderStats()` - Restart the elapsed-time and frame-count sample when the host resumes its loop
- `destroy()` - Unsubscribe from configuration and release renderer and plugin resources

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

The web-ui package reads editor state for drawing and installs font-derived grid dimensions.
`@8f4e/editor-plugin-code-rendering` owns code text, syntax highlighting, nested block backgrounds, and its private
cache of prepared sprite cells and highlight rectangles. It registers backgrounds through
`registerCodeBlockBackgroundDrawer()`, which runs above block surfaces and below line selection, corners, and text.
Its content drawer uses `registerCodeBlockContentDrawer()`, which runs after backgrounds and line selection, before the cursor,
shape declarations, ordinary block drawers, and overlays. Error-messages contributes its own ordinary block drawer.
Without a content plugin, blocks retain
their backgrounds and editing affordances while no source text is drawn.

Editor-state stores viewport animation targets and exposes the synchronous
`advanceViewportAnimation(state, frameTime, events)` helper. Editor-core calls it before web-ui's `renderFrame()`
from both its scheduled and on-demand frame paths. Each step updates the shared viewport
through `updateViewport()`, including border geometry and `viewportChanged` events, so blocks enter and leave the
visible area throughout the pan. Web-ui's draw path uses those supplied coordinates without advancing the animation.
Hosts for other platforms advance animations with their own frame clock. Editor-state needs no frame scheduler or
cancellation callbacks; web-ui owns no frame loop or pause/resume controls.

The renderer loads its initial atlas and palette from `state.editorConfig`, then subscribes to font and color changes.
Theme-only changes retain the atlas and prepared glyph IDs. Registered render layers receive the same resolved palette.
`DrawContext.drawFill()` uses the shared fill mask, `drawText()` uses fixed ASCII glyph IDs,
and both accept an explicit palette index. The renderer prepares up to 256 palette colors as premultiplied float32
values in a 4 KiB uniform buffer.
Web-ui installs font grid dimensions into `state.viewport.hGrid` and `state.viewport.vGrid` and dispatches
`gridSizeChanged` when those dimensions change. Editor-state refreshes block geometry and viewport anchors without
knowing about fonts or atlases. Pending font loads cannot replace a newer selection or update a destroyed renderer.
Font changes replace the masks and update drawing metrics. Dot positions and sizes live beside the background plugin
in `src/plugins/background/dot-settings.ts`; no background settings come from the font atlas.

Input/output connector sprites and wires belong to `@8f4e/editor-plugin-connectors`.

`@8f4e/editor-plugin-assertion-markers` uses the generic code-block drawer hook to draw passed/failed assertion
indicators after source text. The renderer has no assertion-specific drawer or marker fields.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
