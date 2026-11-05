# Editor Package

This package is the glue that connects the platform-agnostic editor state machine from
`@8f4e/editor-state` with browser APIs and the `@8f4e/web-ui` renderer. It supplies the event dispatcher,
plugin services, and rendering lifecycle. Browser input is supplied by plugins; core owns the state effects
that consume their events. Other platform renderers can replace web-ui.

## Responsibilities

- Initialize the editor-state store and event dispatcher for the web runtime.
- Make the canvas focusable for installed input plugins.
- Initialize the UI renderer with state and memory views, and forward resize events.
- Own the single animation-frame loop, advancing viewport animation before asking web-ui to draw each frame.
- Observe the canvas's CSS dimensions and adapt the drawing buffer and editor viewport when its host resizes it.
- Expose state access, memory view updates, rendering lifecycle controls, and state machine callbacks as extension
  points.

`@8f4e/editor-plugin-mouse-input` forwards DOM mouse and wheel input to core events. Pass `captureWheel: false`
to its factory to leave wheel scrolling to the page. The plugin supports fine- and coarse-pointer devices.
`@8f4e/editor-plugin-touch-input` translates touches and adds configurable viewport gestures on coarse-pointer devices.
Panning uses one finger on both axes by default; hosts can restrict the movement axis to preserve native page scrolling.
Core installs no DOM mouse, wheel, touch, or keyboard listeners.

Hosts can pause rendering without releasing memory through `pauseRendering()`. `releaseRenderingResources()` also
releases reloadable GPU textures, dynamic buffers, and the canvas drawing buffer. `resumeRendering()` restores the
resources and applies any canvas resize that happened while they were released.
`renderFrame()` immediately advances viewport animation and renders the current state, including while the loop is
paused. Core coordinates these steps; web-ui draws the supplied viewport without advancing navigation state.

The editor supports view and edit modes. `@8f4e/editor-plugin-selection-animation` supplies the continuously circling
segment around selected code blocks in both modes.
Keyboard navigation, text editing, and mode switching are supplied by independent plugins composed by the host.
Core retains project editing APIs, history, generic mode actions, and shared text/pointer geometry. The editing plugin
owns edit-mode caret movement and drawing. Core installs no keyboard listeners.

## Plugins

Pass a `plugins` array to initialization. `EditorPlugin` and `EditorPluginContext` are exported by
`@8f4e/editor-core`.

```ts
import initEditor from '@8f4e/editor-core';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { createSwitchPlugin } from '@8f4e/editor-plugin-switch';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';

const editor = await initEditor(canvas, {
	...options,
	plugins: [createMouseInputPlugin({ inputTarget: canvas }), toggleSkipExecutionPlugin, createSwitchPlugin({ writeMemory })],
});
```

A plugin declares an `id` and a synchronous `setup({ store, events, menus, directives, layout, loading, drawers })` function.
Editor-core installs plugins in array order after core state effects, before rendering and initial project loading.
Core first sizes the viewport and loads `options.initialProject` (or an empty project), then dispatches `init` and
passes the returned promises to the renderer. Startup plugins fetch, parse, or restore their project while web-ui
loads the default ibmvga font atlas in parallel. The renderer waits for both and loads any different font selected by
the project before drawing. Core then emits `ready`, which starts optional plugin imports. The mount promise resolves
after this sequence. Setup runs separately for each editor instance; allocate instance data inside setup.
Plugins receive the existing state manager and event dispatcher directly. Store disposal belongs to the editor and
is excluded from the plugin context type. This is a trusted extension interface.

Setup must return a disposer that releases every resource the plugin creates, including subscriptions, listeners,
contribution registrations, and timers. The host calls these disposers in reverse installation order while the state
and dispatcher remain available. It does not track individual registrations. Setup and cleanup errors propagate.
If setup throws, that plugin must unwind its partial allocations; the host disposes previously completed plugins.
Initialization failures later in startup also dispose installed plugins.

Plugins publish operations with `loading.add({ id, message })`, receiving `done()`, `fail()`, and `cancel()` methods.
The first terminal call records a finish timestamp and retains the result in the unified `state.loadingIndicators`
list. A repeated ID replaces its entry without allowing old handles to update it. State records epoch-millisecond
start/finish times. The loading-indicators plugin draws prepared elapsed-time/status rows and tracks visibility
privately: done results hide after one second, failed/cancelled after five, oldest eligible finish first at 25 ms
intervals. Contributions stay in state independently of presentation; same-ID replacements become visible again.

Keep browser dependencies in plugin factories rather than the shared setup context. A browser host can create
`createScreenshotPlugin({ canvas, renderFrame: () => editor.renderFrame() })` before initializing the editor; the
returned plugin captures those dependencies and uses the regular setup services. The render callback runs from
actions after initialization, once `editor` is available. Each editor receives a plugin bound to its own canvas.

Register menu items with `menus.registerItem('moduleMenu', provider)`. Providers receive the current
`{ state, codeBlock }` when the menu opens, and return a `ContextMenuItem` or `undefined` to omit it. The target block
can differ from the selection. Contributions appear in registration order after Enable/Disable. The item uses the
existing event dispatcher through its `action` and `payload`. Registration returns an unregister function.
Menu items stay raw in `state.contextMenu`: `open`, requested world anchor `x`/`y`, `items`, and `menuStack`.
`@8f4e/editor-plugin-context-menu` owns decorated labels, geometry, and hovered rows privately. Core forwards
`contextMenuPointerMove` and completed `contextMenuPointerDown` events while blocking input below an open menu.
Presentations request `activateContextMenuItem { index, x, y }` with viewport coordinates; core applies the item's
close behavior and dispatches its action or selector. `closeContextMenu` closes without activation.

Use `menus.registerItem('mainMenu', provider)` for the background menu. Its providers receive `{ state }`, and
contributions appear in registration order after the built-in items. Main-menu contributions are rebuilt when the
menu opens or is revisited, just like block-menu contributions. A divider separates the contributed items when present.

Register a complete submenu with `menus.registerMenu(id, (state, payload) => items)`. Generators may return an
array or a promise and receive current state whenever the menu opens or is revisited. Open it through
`{ action: 'openSubMenu', payload: { menu: id, payload: yourData }, close: false }`. Core stores the request, supplies
Back navigation, and handles decoration, sizing, positioning, and clicks. Menu IDs identify one generator per editor;
use a distinct ID for your plugin's menu and call the returned unregister function during disposal.
The built-in block submenu also uses this request shape: `{ menu: 'moduleMenu', payload: { codeBlock } }`.

Use explicit block actions through `events.dispatch`:

- `createCodeBlock` receives `{ x, y, blockType }` and creates a module, function, prototype, or note template.
- `insertCodeBlock` receives `{ x, y, code }` and inserts those source lines without reading the clipboard.

Coordinates are viewport pixels. Core applies entry assignment, grid positioning, and persistence; declaration names remain unchanged.
Newly inserted blocks already carry their source-derived type; core keeps it current as source changes.

Directive handling and layout are independent services. `directives.register(definition)` contributes block or
source-display behavior through `apply`; core owns generic syntax parsing. A plugin can read parsed directives with
`matchEditorDirectives(codeBlock.parsedDirectives, definitions)` from `@8f4e/editor-state` without registering behavior
in the directive registry. Core updates these records when source changes and retains unknown directives for plugins
installed later. Matching normalizes aliases and preserves source context, including `isTrailing`; all directives
support standalone and trailing comments. Use `parseBlockDirectives(code)` for incoming source or whole-project
snapshot scans such as lazy loading. Live-block consumers reuse cached records.

Use `layout.createContribution()` for a plugin-owned set of block layout requests:

```ts
const contribution = layout.createContribution();
contribution.update(codeBlock, {
	verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 8 }],
	minGridWidth: 40,
});
const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
	// Recalculate requests from current source/state, or derive drawing and hit-test geometry.
	// Width, height, display rows, gaps, and cursor coordinates are current.
});
```

Requests are values, independent of directives. Space requests use zero-based source lines and editor rows. Requests
after the same line add together; minimum widths combine by maximum, in editor columns. Core maps source lines to
display rows and skips hidden lines. Each update replaces this contribution's complete request for that block.
`contribution.remove(codeBlock)` clears one block, and `contribution.dispose()` removes the owner's requests.

`layout.subscribe(listener)` immediately reports the visible blocks and reports them again when core calculates their
layout, including source, compiler metadata, grid size, and contribution changes. It returns an unsubscribe function.
Subscribers may update their requests; core finishes pending recalculations synchronously before notifying the render
projection. An unchanged submission is a no-op, allowing requests derived in subscriptions to settle without recursive
refresh loops. Keep widget data private and use the final geometry for both drawing and hit testing.

Subscribe and dispose explicitly. Unsubscribe before disposing a contribution so your callback cannot resubmit it.
Contribution changes preserve source, selection, project revision, and compiler input revision. Hidden project slices
use their requests when opened. The lazy loader only imports and installs plugins; it has no layout refresh policy.

Register block drawing with `drawers.registerCodeBlockDrawer(drawer)`. Each callback receives
`{ draw, state, codeBlock, memoryViews }` once per visible block per frame, in registration order. Coordinates are
relative to the block; web-ui owns the single traversal, visibility checks, and viewport translation. Later
registrations draw over earlier ones, including plugins installed asynchronously. There are no separate block
background, content, foreground, or overlay stages. Registration returns an unregister function for plugin disposal.

Install `@8f4e/editor-plugin-code-block-background` before code rendering. It owns the
normal, disabled, and dragged base surfaces and corner markers, including their selected colors. Code rendering
draws nested highlights, the selected-line fill, and text in that order. Other plugins add their drawers after these.
For offscreen blocks, `drawers.registerOffscreenCodeBlockDrawer((draw, codeBlock, state) => ...)` replaces a single
callback in the same traversal. Coordinates are world coordinates. The latest registration wins; disposal clears
its slot only if that callback is still registered, without restoring a previous callback. `canvasOverlays` hides
these decorations during screenshot capture. `@8f4e/editor-plugin-offscreen-block-arrows` owns arrow placement and drawing.

Use the drawing surface's text/fill primitives and shared numeric palette indices. `@8f4e/web-ui` exports drawing
types. Plugins own their prepared data and disposal; core stores no widget presentation fields.

Raw source errors live in `state.codeErrors: Record<string, CodeError[]>`. Contributors replace their own lists through
`store.set('codeErrors.my-plugin', errors)` and clear or remove them on disposal. `CodeError` carries a zero-based
source line, a message, and the target block identity or project-group scope. Compiler and directive errors use
`compiler` and `editor-directives`; test-runtime publishes failed source assertions under `test-runtime`.
`@8f4e/editor-plugin-error-messages` owns wrapping, reserved rows, colors, and drawing coordinates through the existing
layout/drawer APIs. Core stores no prepared error widgets and applies only generic row contributions.

Register viewport-coordinate drawing below code blocks with `drawers.registerCanvasBackgroundDrawer(drawer)`.
Callbacks receive `{ draw, state, memoryViews }` above the procedural background and independently of `canvasOverlays`.
`@8f4e/editor-plugin-entry-outlines` draws borders and labels through this hook. Editor-state owns the padded
world-space regions in `state.codeBlockRendering.entryBounds`, alongside entry definitions and block membership.
Module insertion selects the first containing entry, including its edges, or allocates a fresh entry outside all
bounds. Bounds update after layout, project, grid, and viewport changes. These semantics work without a drawing plugin.

Register ordinary viewport-coordinate drawing with `drawers.registerCanvasDrawer(drawer)`. Callbacks receive
`{ draw, state, memoryViews }` after code blocks and before overlays, independently of `canvasOverlays`. Context-menu
presentation uses this hook. Shared canvas drawing types are `CanvasDrawer` and `CanvasDrawerContext`.

Register viewport overlays with `drawers.registerCanvasOverlay(drawer)`. The drawer receives
`{ draw, state, memoryViews }` after ordinary canvas drawers and before modal overlays, with coordinates relative to the viewport's top-left.
The renderer checks `featureFlags.canvasOverlays` before invoking this stage.
Visible overlays receive `canvasOverlayPointerDown` before block controls are probed. Set `stopPropagation` on the
normalized pointer event to claim a press; own capture-phase movement, release, and cancellation for that gesture.
Open context menus and modal dialogs take priority, and disabled canvas overlays receive no presses. Keyboard hints live in their
mode-switching plugin; screenshot capture hides canvas overlays through this generic flag.

Register modal sprite overlays with `drawers.registerModalOverlay(drawer)`. This uses the same viewport context
as canvas overlays and runs after them, independently of `featureFlags.canvasOverlays`.
`@8f4e/editor-plugin-dialogs` uses it for dialog drawing and keeps calculated geometry private.

The editor owns dialog content and lifecycle. Plugins dispatch `addDialog` with `DialogContent`
(`{ id, title, text, buttons }`), `removeDialog` with an ID or `{ id }`, and `clearDialogs` to empty the stack.
Adding an existing ID replaces it at the top. `state.dialogStack` keeps original content and `state.dialog` exposes
the visible dialog's content. Buttons specify `title`, optional `action`/`payload`, and optional `close: false`.
The editor closes a dialog before dispatching its button action by default.

Modal input is blocked by the editor even without a drawing plugin. The editor forwards completed presses through
`dialogPointerDown`. The dialogs plugin resolves its private button geometry and requests `activateDialogButton`
with `{ id, buttonIndex }`; the editor checks the visible dialog and runs the button action. Capture-only input
probes do not activate dialogs. Default and minimal compositions
install the presentation plugin through their deferred registries. Custom compositions must install it to show dialogs.

Register canvas-wide GPU passes with `drawers.registerRenderLayer(factory)`. The factory receives `{ gl, palette }`
once the renderer is ready and returns `{ draw, destroy, loadPalette?, releaseMemory? }`. `draw` receives
`{ state, memoryViews }` every frame after sprites in registration order, independently of block culling.
Palette changes and memory release are forwarded to the layer. Registration may precede renderer initialization or
arrive later; unregistering destroys the active layer, and renderer disposal destroys all layers before its context.
Types and generic WebGL resource helpers are exported by `@8f4e/web-ui`.

`@8f4e/editor-plugin-connectors` owns input/output connectors, expanded `shape`/`paramShape` declaration labels,
their row reservations, and the complete wire renderer through these hooks. Prepared labels and endpoint data stay
private to the plugin; core has no widget presentation fields. Compiler semantics remain independent of this plugin.
Core keeps memory semantics independent of connector data and has no connector-specific fields or GPU resources.
`@8f4e/editor-plugin-texture-runtime` owns editor-frame WASM execution and block-bound `@texture` framebuffer views through the same overlay hook.

Both input adapters emit normalized `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` events.
`InternalPointerEvent` and `CodeBlockPointerDownEvent` are shared contracts in `@8f4e/editor-state-types`.
Core routes both adapters through the same block lookup and interaction phases, independently of module dragging.

Controls subscribe to `codeBlockPointerDown` in capture, set `stopPropagation` when claiming the press, handle
`codeBlockPointerMove` for drags, and release on `codeBlockPointerUp`. Ordinary block press listeners run after
default selection. Dialogs and menus retain priority over controls. Capture listeners run first in registration order;
setting `stopPropagation` stops the remaining listeners. Event dispatch can select only the capture or normal phase
with `{ phase: 'capture' | 'normal' }`, which lets touch input probe interactions before starting a viewport gesture.
Unregister with the same `events.off` call as other listeners.

Core dispatches `resolveCodeBlockDragTargets` with `{ codeBlock, altKey, targets: [codeBlock] }` before a drag.
Plugins may synchronously replace `targets`; core then moves and snaps those blocks and publishes one position edit.
Block copy/paste belongs to `@8f4e/editor-plugin-code-block-copy-paste`. Its factory receives browser read/write functions; core has no clipboard callbacks or copy/paste actions. Grouping receives its own writer for Copy Group. Keyboard-editing separately handles native text pastes at the caret.

`insertCodeBlocks(store, { x, y, blocks })` inserts a source batch at a viewport position, preserving relative positions, source names, references, group membership, and nested entry tables. Only `@pos` is rewritten for placement. `serializeCodeBlocks(blocks, anchor)` returns detached `SerializedCodeBlock` sources with relative coordinates and recursively owned project slices. These helpers contain no browser or clipboard format handling.

The switch and button plugins own their directives, memory resolution, interaction, and drawing. Each keeps widget
data in a per-instance WeakMap. Buttons write their on value while pressed and their off value on release.
The wave plugin owns `@wave`, `@wave2`, and `@wave4`, including their layout space, typed samples, playheads, and drawing.
The piano plugin owns `@piano`, key geometry, runtime note toggling, drawing, and its save-to-code menu action.
The slider plugin owns `@slider`, its geometry, drag interaction, live drawing, and save-to-code menu action.
Meter, plot, and bars plugins own their typed-memory visualization and layout. Crossfade owns its float-memory
interaction and drawer. Watch and stack own separate inline value overlays; their factories receive a
`prefersReducedMotion` function from the host. None of these features adds fields to core code-block state.
The screenshot plugin owns the main-menu action, temporary overlay visibility, PNG encoding, and browser file saving.
The project-open plugin owns Open From Disk and receives the editor's document. The project-save plugin owns
Save/Export, its menu and shortcut, serialization, and browser writes; its factory receives the input element.
Both receive one file session holding the current handle and its reset lifecycle. The WebAssembly-export plugin receives a document and compiler
byte getter, and owns WASM Blob creation and browser file writing.
The execution-toggle plugin owns the Skip/Unskip menu item and its action. The tooltips plugin owns selected-line documentation, stack analysis, live memory values,
layout, animation, and overlay drawing, with its state private to each installation. Nested block shading remains
built in. The core installs no plugins by default; `@8f4e/editor-default` selects the standard set.

The grouping plugin owns `; @group <name> [nonstick]`, private group membership, grouped dragging, copying,
and all visual-group menu actions, including group execution toggling. Nested language-level project
groups (`group … groupEnd`), their navigation, and memory scopes remain in core.

The favorites plugin owns `@favorite` detection, Favorite/Unfavorite editing, and Jump to navigation menus. Core
provides generic directive parsing and block jumping. The memory-connection-removal plugin owns its block-menu item, enabled
state, and source transformation for disconnecting intermodular memory defaults. Both receive the clicked block
through their action payload and respect edit mode; their menu entries disappear when the plugins are omitted.
The public `removeDirective` helper edits generic directive comments without coupling core to either action.

The assertion-markers plugin draws runtime results over assertion line numbers using current block layout; core
keeps the results and inline failure messages. Keyboard-to-memory input and MIDI input live in their plugin packages.
Their factories receive the input target or navigator and compiler-resource getters from the host. Each plugin
owns its configuration schema and cleanup. MIDI also owns its WASM instance and export cache; there is no separate
environment-plugin manager in core.

The binary-assets plugin owns `bin` configuration, browser fetching and caching, private asset bytes/metadata,
memory copies, download-indicator lifecycle, and generated asset-size constants. Its factory receives a getter for current
runtime memory bytes; the shared plugin context carries no browser resources or binary asset fields.

Plugins can contribute source to the generated `env` constants block with
`store.set('envConstantContributions.myPlugin', ['const MY_VALUE 42'])`. Core combines contributed lines and recompiles when generated source changes. Each plugin removes its own contribution key
when disposed. The registry contains source lines only; feature metadata stays private to its owner.

`@8f4e/editor-state` exports shared source-edit, directive-argument, row-layout, text-wrapping, stack-value formatting,
tab-aware text measurement, module identity, and compiled-function lookup helpers. Its `/memory` entry
exports memory scope, identifier, element-count, and typed-value resolution, plus `getMemoryDefaultEdits` for rewriting
resolved memory defaults in their source modules. Each group of values is edited together, even across module owners.
Plugins use these public exports rather than importing core files.
`serializeToProject` and `getExportBaseName` provide shared project-model serialization and naming;
`logError` records failures in the editor console. These helpers and filename configuration remain available
independently of the export and persistence plugins.
Project-model serialization lives under `pureHelpers/projectSerialization`; filename configuration belongs to
`features/editor-config`. The project-save plugin owns its private `.8f4e` text formatter.
`serializeToProject(state)` and `serializeProjectLevel(level)` return detached models with independent source arrays
throughout nested groups. Their fixed field order and grid/creation ordering support direct JSON comparison of canonical models.

## Project changes

API revisions, history, and session persistence share `state.projectChange`, a record containing a monotonic
`revision` and an operation `kind`. The public `editor.editing.getRevision()` token combines that revision with its
editor-handle identity. Reading a revision does not serialize the project. Loads invalidate existing tokens even
when the new source is identical, and undo/redo advance the revision when restoring earlier content.

Source-mutating plugin actions use `applyCodeBlockSourceEdits(store, edits, { affectsCompilation })` from
`@8f4e/editor-state`. Each edit supplies `{ codeBlock, code }` with the replacement source array. The helper skips
unchanged source, refreshes changed blocks, and publishes one project change after the whole batch. Set
`affectsCompilation: false` for metadata such as positions, favorites, and grouping; use `true` for compiler inputs.
`deleteCodeBlocks(store, blocks)` removes blocks from the visible project slice in place, clears references to
deleted blocks, and publishes one project and compiler-input change. Both helpers return whether anything changed.
Callers own edit-mode checks and source transformations; they do not separately publish the same operation.
Selection, navigation, and no-op actions do not publish. History batches ordinary edits and gives validated API
batches an immediate undo step; persistence saves each completed change.

The project-operations effect applies validated API drafts independently of history. It emits `beforeProjectEdit`
for a changed draft, allowing history to commit pending typing, then publishes the completed checkpoint. Unchanged
drafts leave pending history and revisions untouched.

Core project-loading, API operations, and history helpers publish `checkpoint`, `restore`, or `replace` changes after
snapshot restoration and generated constants have settled. Consumers can read `editor.state` and use the editing handle for
validated writes. Core mutation paths outside these helpers call `publishProjectChange(store)` after their completed
operation; direct state writes alone do not announce a revision. `compilerInputRevision` remains a separate signal
for compilation inputs.

## Project loading

Hosts can provide a compiler-owned `ProjectObjectModel` through `initialProject`, or dispatch `loadProject` with
`{ project }` later. Core loads initial content after sizing the viewport. Project preparation through `init` runs
alongside the default font download; both complete before rendering and the `ready` event.
Open From Disk belongs to the project-open plugin. Core has no file callbacks or file-association flags; undo/redo
restore snapshots directly within the current project.

Session restoration and autosaving belong to `@8f4e/editor-plugin-session-persistence`. Project URL fetching and
parsing belong to `@8f4e/editor-plugin-project-url-loader`. Both plugins use generic project loading, and their factories
receive storage or fetch from the host. Core has no session callbacks, storage quota state, or URL fetching callback.
Example project browsing belongs to the host. Built-in module browsing belongs to `@8f4e/editor-plugin-example-modules`,
whose factory receives lazy source loaders. Core retains generic menus and block creation.

## Docs

- `docs/editor-directives.md` - Editor-only code-block directive syntax (`; @...`) and supported directives.

## Editor Config

Configure editor settings with `; @config <path> <value>`.

- Web-ui contributes the schemas and validation for `font` and color overrides. Editor-state handles their
  `@config` directives through the same generic configuration registry used by plugins.
- `resolveEditorConfig(store)` re-resolves source configuration without changing source or project revisions.
  Plugins can use it to restore source settings after removing a temporary override and its subscriptions.
- Runtime plugins own their independent `audioRuntime.enabled`, `workerRuntime.enabled`, `testRuntime.enabled`, and `textureRuntime.enabled` settings.
- Extensions can contribute schema-backed config roots; runtime packages use this for paths like `; @config audioRuntime.sampleRate 48000` and `; @config audioRuntime.audioOutBufferLAddress audioout:buffer`.
- `; @config export.fileName <value>` controls the base file name used by editor export actions.
- `; @config color.<path> <value>` controls base palette colors.
- `; @config textureRuntime.<field> <value>` configures the opt-in texture runtime, which controls entry execution once per editor frame. `; @textureUpload <address> <format> <width> <height>` declares a source, and `; @texture <address> <magnification> <width> <height> [<x> <y>]` displays a full or cropped view while reserving block space.
- Base colors accept hex with optional alpha, `rgb()` / `rgba()`, and `transparent`. The palette contains `canvas`,
  `surface`, `ink`, `muted`, `primary`, `secondary`, `tertiary`, `highlight`, `detail`, `stroke`, `positive`, `warning`,
  and `negative`. Optional accents preserve independently authored hues and opacity.
  Web-ui resolves shades and fixed opacity variants independently of the font atlas.

Example color overrides:

```txt
; @config color.canvas #660099
; @config color.surface #1a0b24
; @config color.ink #f6eff8
; @config color.primary #d9a6ff
```

- `docs/color-paths.md` - Configurable color paths for `; @config color.<path> <value>`.

## Font

Select the editor font with a global editor directive. Web-ui owns supported fonts, defaults, atlas loading, and
configuration subscriptions. State uses the resulting grid dimensions for layout and hit testing:

```txt
; @config font ibmvga8x16
```

The supported catalog is `FONT_NAMES` from `@8f4e/sprite-generator`. In the default desktop editor, the independent
font-preview plugin uses F18/F19 to cycle through that catalog temporarily. Previewing does not change source or saved
files; loading a project restores its configured font. The minimal editor omits this plugin.

Runtime execution belongs to ordinary browser plugins. Each receives compiler getters through its factory, imports its own worker/worklet assets, contributes schemas and constants, and publishes its own info namespace. The audio plugin can borrow a host-supplied AudioContext. Runtimes can run concurrently; core owns no execution registry or selector. Shared `state.info` records remain available as data; updates do not invalidate code-block layout or text render data. Memory-writing plugins receive a `writeMemory(address, value, isInteger)` function directly from their host.

Core emits `compilationInputChanged` after compilation inputs change. Install `@8f4e/editor-plugin-compiler` to schedule compilation and publish diagnostics, compiler metadata, and statistics. Core consumes its `compilationSucceeded` event with `ProgramArtifacts` (`memoryRef`) to update generic memory views. Public editor options no longer expose a callbacks bag; core constructs its internal browser callbacks. The compiler factory returns stable artifact getters and a memory writer for dependent feature and runtime plugins; core has no compile callback. Plugins dispose in reverse installation order, releasing runtime resources before their compiler dependency.

Plugins dispatch `memoryValuesChanged` when external execution changes memory, so core can refresh derived layout and rendering.
