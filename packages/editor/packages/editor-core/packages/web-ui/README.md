# Web UI Package

This package composes editor frames using a renderer supplied by the host. It owns font and color configuration,
font atlas loading, and palette updates. Drawing reads editor state and memory views; font changes update the shared
layout grid. The browser editor supplies a Glugglugglug engine.

Rendering is backed by `glugglugglug`. Glyph IDs are CP437 slots 0–255 and fill is 256, so
per-frame drawers submit positions, sizes, shared shape IDs, and numeric palette indices. Plugins can register canvas-wide GPU passes above the sprites. A procedural dotted background runs before the sprite pass.

The default framebuffer has no depth buffer; passes use explicit drawing order. Custom raw-context hooks requiring
depth testing must use a framebuffer with their own depth attachment.

## Rendering plugins

Web-ui owns the procedural background under `src/plugins/background`. It precomposes dot colors over the base
when the palette changes and draws one triangle before sprites. The shader's dot pattern follows the same presented
camera as the scene, without any of the presentation offsets applied to individual blocks. Glugglugglug owns sprite rendering.

Canvas-wide editor layers run after sprites in registration order and before render statistics are sampled.
Web-ui supplies shader helpers and forwards palette changes, memory release, and disposal.
`@8f4e/editor-plugin-wires` owns the WebGL wire pass; `@8f4e/editor-plugin-texture-runtime` owns block-bound framebuffer
views in the overlay, their optional WASM execution, and shared GPU resources.

## API

`createEditorDrawerRegistry()` creates one ordered code-block drawer registry, background/ordinary canvas drawers, and canvas/modal overlay
hooks and GPU render-layer registration. Pass that registry through `options.drawers` when initializing the renderer.

### `registerCanvasBackgroundDrawer(drawer)`

Registers viewport-coordinate drawing below code blocks and above the procedural background, independently of
`canvasOverlays`. Callbacks receive `{ draw, state, memoryViews, renderGeometry }` and run in registration order. Registration returns an
unregister function. The entry-outlines plugin draws borders and labels from core entry bounds through this hook. It uses the shared
`CanvasDrawer` and `CanvasDrawerContext` types.

### `registerCanvasDrawer(drawer)`

Registers viewport-coordinate drawing after code blocks and before canvas/modal overlays, independently of
`canvasOverlays`. Registrations draw in order and return unregister functions. The context-menu plugin uses this
hook; web-ui contains no menu-specific drawing. The shared types are `CanvasDrawer` and `CanvasDrawerContext`.

### `registerModalOverlay(drawer)`

Registers a viewport-coordinate sprite drawer after menus and ordinary canvas overlays. This stage runs even
when `featureFlags.canvasOverlays` is false. The callback receives `{ draw, state, memoryViews, renderGeometry }` and registration
returns an unregister function. `@8f4e/editor-plugin-dialogs` owns dialog layout and drawing through this hook;
web-ui contains no dialog-specific rendering.

### `registerWebUiConfig(store)`

Registers schema-backed validators for `; @config font <name>` and `; @config color.<base> <value>` in the shared
configuration registry. Editor-core calls this before installing plugins and loading the initial project.
Editor-state parses and resolves configuration generically; web-ui owns supported fonts, color validation, and defaults.

### `init(store, events, renderer, memoryViews, options)`

Initializes the web UI after project source and configuration have settled, without drawing or scheduling frames.
Editor-core owns the browser frame loop. Web-ui takes ownership of the supplied renderer and destroys it on disposal
or startup failure.

**Parameters:**

- `store: StateManager<State>` - Editor state and configuration subscriptions
- `events: EventDispatcher` - Announces layout grid size changes
- `renderer: WebUiRenderer` - A Glugglugglug engine or an implementation of the sprite and render-hook API used by web-ui. Test renderers can provide no-op GPU operations, but `renderFrame` must still dispatch `preDraw` and `postDraw` hooks around sprite submission.
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `options.defaultFont` - Optional per-editor default (`ibmvga8x16` when omitted), used whenever project configuration has no font directive. Only the selected font is loaded at startup; the default still applies to later configuration changes.
- `options.loading` - Required per-editor loading service supplied by editor-core; font changes contribute ID `font` with message `Loading font <name>...`
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
It prepares its renderer-owned `RenderGeometry` before each frame, containing a `RenderedCodeBlock` for every block in the active project,
including offscreen blocks. Each object references its original editor-state `codeBlock` and has a separate
viewport-relative pixel origin (`x`, `y`). This is the block's presented position, distinct from its logical position in state.
The ordered `blocks` array and `blocksByCodeBlock` map reference the same objects. Canvas drawers and GPU render layers
receive this shared geometry so cross-block drawing can use the presented position of each endpoint. Consume it as read-only
during drawing, without retaining the geometry or individual records across frames: web-ui reuses this storage and updates the
positions before the next frame. Editor-state remains the owner of logical block positions and hit testing.
The drawer registry can prepare one optional position effect per frame. Its per-block viewport-pixel translations
are added when building shared geometry, before visibility checks or any drawing stage consumes the positions.
Block plugins use one `registerCodeBlockDrawer()` registry, invoked in registration order once per visible block.
The block drawer context includes the original `codeBlock`; its `draw` context already translates coordinates relative to
the presented block origin. Web-ui retains traversal and culling, using presented positions for both. A single replaceable
`registerOffscreenCodeBlockDrawer(drawer)` callback receives `(draw, renderedBlock, state)` and handles offscreen blocks
in the same traversal using viewport coordinates. Later registrations overwrite it; disposal clears only the current callback and restores nothing.
`canvasOverlays` controls these decorations. `@8f4e/editor-plugin-offscreen-block-arrows` owns arrow geometry and drawing.
`@8f4e/editor-plugin-code-block-background` supplies base rectangles and corner markers, including selected colors,
and is installed before code rendering.
`@8f4e/editor-plugin-code-rendering` owns nested highlights, selected-line fill, text, and its private prepared data.
Code rendering invokes `drawCodeBlockTextBackgrounds(context)` between nested shading and selected-line fill.
Plugins can use `registerCodeBlockTextBackgroundDrawer(drawer)` for backgrounds below source text, even when installed
after code rendering. These callbacks use the ordinary block context and run in registration order; disposal removes
only the registered callback.
Connectors and other plugins use the same registry. Registration order determines layering, including late installs;
there are no separate block drawing phases. Ordinary canvas drawers, viewport overlays, modal overlays, and GPU render layers retain their own hooks.
Without a background plugin, web-ui draws no block surface.

Editor-state commits navigation immediately and emits a single navigation-tagged `viewportChanged`. Web-ui samples a
200 ms visual camera glide from the last presented origin using the timestamp supplied to `renderFrame()`. It projects
blocks, culling, the shader background, and canvas drawers from this same camera. Canvas drawers receive its frame-scoped
`viewport`; layout and hit testing keep using `state.viewport`. The glide suppresses separate block offsets and new pointer
presses, and is skipped for reduced motion. Core schedules frames; neither web-ui nor editor-state owns another frame loop.

After source preparation, the renderer loads its initial atlas and palette from `state.editorConfig`, then subscribes to
font and color changes.
Theme-only changes retain the atlas and prepared glyph IDs. Registered render layers receive the same resolved palette.
`DrawContext` owns nested coordinate groups and sends viewport-relative sprite positions to a `SpriteTarget`.
The browser renderer uses the Glugglugglug engine as that target.
`DrawContext.drawFill()` uses the shared fill mask, and `drawGlyphs()` draws prepared CP437 glyph IDs.
Use the pure `textToGlyphIds()` helper during state/layout preparation and keep its result in the owning plugin.
Fixed symbols can be prepared once, and their IDs remain valid across font changes. `drawResolvedText()` consumes
prepared glyph/color cells. `drawNumericText()` trusts formatted live readouts to contain ASCII numeric text and
uses their character codes directly, without validation or Unicode mapping. All drawing methods accept explicit
palette indices. The renderer prepares up to 256 palette colors as premultiplied float32
values in a 4 KiB uniform buffer.
Web-ui supplies the installed font's grid dimensions to editor-state, which updates `state.viewport.hGrid` and
`state.viewport.vGrid`, dispatches `gridSizeChanged` when those dimensions change, and refreshes block geometry
without knowing about fonts or atlases. The editor has no grid until the initial atlas is installed. During later font changes, the current
grid remains usable for rendering while `state.gridSizeReady` is false. Once the selected atlas has been installed
and any changed dimensions have been applied to layout, editor-state sets `state.gridSizeReady` and completes pending
first-visit viewport placement. Same-sized atlas changes, cancellation back to the applied font and failed replacements
also settle readiness, without invalidating unchanged grid geometry. Pending font loads cannot replace a newer selection
or update a destroyed renderer. A failed current replacement reports the error and retains the applied atlas and grid.
Each font change replaces the `font` contribution with a custom message and reports done/failed on completion.
Supersession and disposal cancel pending attempts; results remain in state independently of indicator visibility.
Font changes replace the masks and update drawing metrics. Dot positions and sizes live beside the background plugin
in `src/plugins/background/dot-settings.ts`; no background settings come from the font atlas.

Input/output connector sprites belong to `@8f4e/editor-plugin-connectors`. The optional WebGL wire pass belongs to
`@8f4e/editor-plugin-wires`.

`@8f4e/editor-plugin-assertion-markers` uses the generic code-block drawer hook to draw passed/failed assertion
indicators after source text. The renderer has no assertion-specific drawer or marker fields.

## Scene snapshot tests

The test-only `AsciiRenderer` from `@8f4e/web-ui-testing` plugs into `init()` and renders the normal sprite sequence to a
fixed-width text grid. Cells sample sprite rectangles at their centers: later visible sprites overwrite earlier ones,
visible fills write spaces, and non-ASCII glyphs appear as `?`. This covers scene composition and clipping without a
browser; font masks, partial alpha blending, the dotted backdrop, and GPU wires are not represented in the text output.

Viewport baselines live in `__snapshots__/*.viewport.snap` next to the tests. They store the entire viewport as plain
text, with one fixed-width line per row. Keep trailing spaces and empty rows: they are part of the viewport. Tests
that use a real canvas for input can use `createAsciiCanvasRenderer(canvas)` and `readAsciiViewport(canvas)` from
the testing package without changing how input or resizing is exercised.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
