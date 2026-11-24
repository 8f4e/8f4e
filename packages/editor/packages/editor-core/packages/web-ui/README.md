# Web UI Package

This package composes editor frames using a renderer supplied by the host. It owns font and color configuration,
font atlas loading, and palette updates. Drawing reads editor state and memory views; font changes update the shared
layout grid. The browser editor supplies a Glugglugglug engine.

Rendering is backed by `glugglugglug`. Glyph IDs are CP437 slots 0–255 and fill is 256, so
per-frame drawers submit positions, sizes, shared shape IDs, and numeric palette indices. Plugins can register canvas-wide
GPU passes before or after the sprite pass. Web-ui does not install a background by itself.

The default framebuffer has no depth buffer; passes use explicit drawing order. Custom raw-context hooks requiring
depth testing must use a framebuffer with their own depth attachment.

## Source layout

- `src/index.ts` — Public exports; `initializeWebUi.ts` sets up fonts, frame drawing, and resource lifecycles.
- `src/frame/` — Frame drawing and block traversal (`drawFrame.ts`, `drawCodeBlocks.ts`), shared frame inputs
  (`frameContext.ts`, `blockPositions.ts`), plugin registrations (`renderRegistry.ts`), and statistics (`frameStats.ts`).
- `src/camera/` — Visual viewport transitions.
- `src/sprites/` — Sprite drawing coordinates and prepared glyph cells.
- `src/font-and-palette/` — Font and palette configuration, loading, and grid updates.
- `src/webgl/` — GPU render-layer lifecycles and shared shader helpers.

## Rendering plugins

Canvas-wide render layers run in their registered stages, before or after sprites, in registration order within a stage.
Web-ui supplies shader helpers and forwards palette changes, memory release, and disposal.
`@8f4e/editor-plugin-dotted-background` supplies the procedural background before sprites; compositions choose which
background layers to install. Glugglugglug owns sprite rendering.
`@8f4e/editor-plugin-wires` owns the WebGL wire pass; `@8f4e/editor-plugin-texture-runtime` owns block-bound framebuffer
views in the overlay, their optional WASM execution, and shared GPU resources.

## API

`createEditorRenderRegistry()` creates an `EditorRenderRegistry` with ordered code-block drawers, canvas background
and overlay hooks, and GPU render-layer registration. Pass that registry through `options.renderRegistry` when initializing
the renderer.

### `registerCanvasBackgroundDrawer(drawer)`

Registers viewport-coordinate sprite drawing below code blocks and above before-sprites GPU layers, independently of
`canvasOverlays`. Callbacks receive `{ draw, state, viewport, memoryViews, blockPositions }` and run in registration order. Registration returns an
unregister function. The entry-outlines plugin draws borders and labels from core entry bounds through this hook. It uses the shared
`CanvasDrawer` and `CanvasDrawerContext` types.

### `registerCanvasOverlay(drawer)`

Registers viewport-coordinate drawing above code blocks and below context-menu and modal overlays. This stage runs
only when `featureFlags.canvasOverlays` is true. Registrations draw in order and return unregister functions.
The shared types are `CanvasDrawer` and `CanvasDrawerContext`.

### `registerContextMenuOverlay(drawer)`

Registers viewport-coordinate drawing above ordinary canvas overlays and below modal overlays, independently of
`canvasOverlays`. The context-menu plugin uses this hook; web-ui contains no menu-specific drawing.

### `registerModalOverlay(drawer)`

Registers a viewport-coordinate sprite drawer after menus and ordinary canvas overlays. This stage runs even
when `featureFlags.canvasOverlays` is false. The callback receives `{ draw, state, viewport, memoryViews, blockPositions }` and registration
returns an unregister function. `@8f4e/editor-plugin-dialogs` owns dialog layout and drawing through this hook;
web-ui contains no dialog-specific rendering.

### `registerRenderLayer(stage, factory)`

Registers a GPU pass in `'beforeSprites'` or `'afterSprites'`. The factory receives the renderer's WebGL context and
resolved palette when rendering resources become available. Its returned layer
may implement `loadPalette(palette)` and `releaseMemory()` alongside the required `draw(context)` and
`destroy()` methods. The latter runs on unregistration or renderer disposal.

Each layer draws with `{ state, viewport, memoryViews, blockPositions }`. The `viewport` supplies the current presented camera
and installed grid dimensions, and block positions are prepared once before either GPU stage or sprite submission. Registrations made
after initialization receive the current palette. The dotted-background plugin derives dot geometry from the frame's grid;
layers do not need font-specific notifications.

### `registerWebUiConfig(store)`

Registers schema-backed validators for `; @config font <name>` and `; @config color.<base> <value>` in the shared
configuration registry. Editor-core calls this before installing plugins and loading the initial project.
Editor-state parses and resolves configuration generically; web-ui owns supported fonts, color validation, and defaults.

`getAppearanceFont(state, defaultFont)` selects the transient `state.appearance.fontOverride`, the authored
`state.editorConfig.font`, or the default font, in that order. Plugins can set or clear the override without changing
project configuration. Web-ui subscribes to both font settings and loads an atlas for the selected font.

### `initializeWebUi(store, events, engine, memoryViews, options)`

The package's default export initializes the web UI after project source and configuration have settled, without drawing
or scheduling frames. Editor-core owns the browser frame loop. Web-ui takes ownership of the supplied sprite engine and destroys it on disposal
or startup failure.

**Parameters:**

- `store: StateManager<State>` - Editor state and configuration subscriptions
- `events: EventDispatcher` - Announces layout grid size changes
- `engine: SpriteEngine` - A Glugglugglug engine or an implementation of the sprite and render-hook API used by web-ui. Test renderers can provide no-op GPU operations, but `renderFrame` must still dispatch `preDraw` and `postDraw` hooks around sprite submission.
- `memoryViews: MemoryViews` - Memory view interfaces for rendering code blocks
- `options.renderRegistry` - Required render registry supplied by the host
- `options.defaultFont` - Optional per-editor default (`ibmvga8x16` when omitted), used whenever project configuration has no font directive. Only the selected font is loaded at startup; the default still applies to later configuration changes.
- `options.loading` - Required per-editor loading service supplied by editor-core; font changes contribute ID `font` with message `Loading font <name>...`
- `options.onRenderStats` - Optional callback for render statistics sampled every 60 frames

**Returns:** An object with methods to control the renderer:

- `resize(width, height)` - Resize the canvas
- `renderFrame()` - Restore released GPU resources as needed and draw one frame from the supplied state
- `releaseRenderingResources()` - Release reloadable GPU resources and the canvas drawing buffer
- `resetRenderStats()` - Start a fresh 60-frame sample when the host resumes its loop so the pause does not affect the measured frame rate
- `destroy()` - Unsubscribe from configuration and release renderer and plugin resources

### `RenderStats`

Type emitted by `options.onRenderStats`:

```typescript
interface RenderStats {
	timeToRenderMs: number; // Duration of the 60th frame only
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
It prepares its renderer-owned `FrameBlockPositions` before each frame, containing a `FrameBlockPosition` for every block in the active project,
including offscreen blocks. Each object references its original editor-state `codeBlock` and has a separate
viewport-relative pixel origin (`x`, `y`). This is the block's presented position, distinct from its logical position in state.
The `ordered` array and `byCodeBlock` map reference the same objects. Canvas drawers and GPU render layers
receive these shared block positions so cross-block drawing can use the presented position of each endpoint. Consume them as read-only
during drawing, without retaining the positions or individual records across frames: web-ui reuses this storage and updates the
positions before the next frame. Editor-state remains the owner of logical block positions and hit testing.
The render registry can prepare one optional position effect per frame. Its per-block viewport-pixel translations
are added when preparing shared block positions, before visibility checks or any drawing stage consumes them.
Block plugins use one `registerCodeBlockDrawer()` registry, invoked in registration order once per visible block.
The block drawer context includes the original `codeBlock`; its `draw` context already translates coordinates relative to
the presented block origin. Web-ui retains traversal and culling, using presented positions for both. A single replaceable
`registerOffscreenCodeBlockDrawer(drawer)` callback receives `(draw, blockPosition, viewport)` and handles offscreen blocks
in the same traversal using presented viewport coordinates. Later registrations overwrite it; disposal clears only the current callback and restores nothing.
`canvasOverlays` controls these decorations. `@8f4e/editor-plugin-offscreen-block-arrows` owns arrow geometry and drawing.
`@8f4e/editor-plugin-code-block-background` supplies base rectangles and corner markers, including selected colors,
and is installed before code rendering.
`@8f4e/editor-plugin-code-rendering` owns nested highlights, selected-line fill, text, and its private prepared data.
Code rendering invokes `drawCodeBlockTextBackgrounds(context)` between nested shading and selected-line fill.
Plugins can use `registerCodeBlockTextBackgroundDrawer(drawer)` for backgrounds below source text, even when installed
after code rendering. These callbacks use the ordinary block context and run in registration order; disposal removes
only the registered callback.
Connectors and other plugins use the same registry. Registration order determines layering, including late installs;
there are no separate block drawing phases. Canvas background drawers, canvas overlays, context-menu overlays, modal overlays,
and GPU render layers retain their own hooks.
Without the code-block-background plugin, web-ui draws no block surface.

Editor-state commits navigation immediately and emits a single navigation-tagged `viewportChanged`. Web-ui samples a
200 ms visual camera glide from the last presented origin using the timestamp supplied to `renderFrame()`. It projects
blocks, culling, and drawing layers from this same camera. Canvas drawers and GPU layers receive its frame-scoped
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
Font changes replace the masks and update drawing metrics. Registered render layers use the installed grid from each frame's
presented viewport; a pending font selection leaves those dimensions unchanged until replacement completes.

Input/output connector sprites belong to `@8f4e/editor-plugin-connectors`. The optional WebGL wire pass belongs to
`@8f4e/editor-plugin-wires`.

`@8f4e/editor-plugin-assertion-markers` uses the generic code-block drawer hook to draw passed/failed assertion
indicators after source text. The renderer has no assertion-specific drawer or marker fields.

## Scene snapshot tests

The test-only `AsciiRenderer` from `@8f4e/web-ui-testing` plugs into `initializeWebUi()` and renders the normal sprite sequence to a
fixed-width text grid. Cells sample sprite rectangles at their centers: later visible sprites overwrite earlier ones,
visible fills write spaces, and non-ASCII glyphs appear as `?`. This covers scene composition and clipping without a
browser; font masks, partial alpha blending, the dotted backdrop, and GPU wires are not represented in the text output.

Viewport baselines live in `__snapshots__/*.viewport.snap` next to the tests. They store the entire viewport as plain
text, with one fixed-width line per row. Keep trailing spaces and empty rows: they are part of the viewport. Tests
that use a real canvas for input can use `createAsciiCanvasRenderer(canvas)` and `readAsciiViewport(canvas)` from
the testing package without changing how input or resizing is exercised.

## Docs

- [Drawer best practices](docs/drawer-best-practices.md)
