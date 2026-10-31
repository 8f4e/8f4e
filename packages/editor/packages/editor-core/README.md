# Editor Package

This package is the glue that connects the platform-agnostic editor state machine from
`@8f4e/editor-state` with browser APIs and the `@8f4e/web-ui` renderer. It wires browser events
(keyboard, mouse, and wheel) into the state machine, then hands the resulting state object
that describes the full application to a UI renderer that treats state as immutable input and
derives the UI purely from it. The renderer is intended to be pluggable so other platform
renderers can replace it.

## Responsibilities

- Initialize the editor-state store and event dispatcher for the web runtime.
- Make the canvas focusable and wire its keyboard, mouse, and wheel input into internal events, so each editor only
  handles input directed at its own canvas.
- Translate DOM input data into internal event payloads (coordinates, movement deltas, button state, canvas size).
- Initialize the UI renderer with state and memory views, and forward resize events.
- Observe the canvas's CSS dimensions and adapt the drawing buffer and editor viewport when its host resizes it.
- Expose state access, memory view updates, rendering lifecycle controls, and state machine callbacks as extension
  points.

Wheel input pans the editor viewport and prevents page scrolling by default. Embedded hosts can set
`captureWheel: false` when initializing the editor to leave wheel input and scrolling to the surrounding page.

Hosts can pause rendering without releasing memory through `pauseRendering()`. `releaseRenderingResources()` also
releases reloadable GPU textures, dynamic buffers, and the canvas drawing buffer. `resumeRendering()` restores the
resources and applies any canvas resize that happened while they were released.
`renderFrame()` immediately renders the current state, including while the animation loop is paused.

The editor supports view and edit modes. Selected code blocks have a continuously animated outline in both modes.
Command+Arrow (or Control+Arrow) navigates between blocks with smooth viewport movement. Use `e` to enter edit mode
and Escape to return to view mode when `modeToggling` is enabled.

## Plugins

Pass a `plugins` array to initialization. `EditorPlugin` and `EditorPluginContext` are exported by
`@8f4e/editor-core`.

```ts
import initEditor from '@8f4e/editor-core';
import { createSwitchPlugin } from '@8f4e/editor-plugin-switch';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';

const editor = await initEditor(canvas, {
	...options,
	plugins: [toggleSkipExecutionPlugin, createSwitchPlugin({ writeMemory })],
});
```

A plugin declares an `id` and a synchronous `setup({ store, events, menus, directives, drawers })` function.
Editor-core installs plugins in array order after core state effects, before rendering and initial project loading.
Core first resizes and loads `options.initialProject` (or an empty project), then emits
`init`. Setup runs separately for each editor instance; allocate instance data inside setup.
Plugins receive the existing state manager and event dispatcher directly. Store disposal belongs to the editor and
is excluded from the plugin context type. This is a trusted extension interface.

Setup must return a disposer that releases every resource the plugin creates, including subscriptions, listeners,
contribution registrations, and timers. The host calls these disposers in reverse installation order while the state
and dispatcher remain available. It does not track individual registrations. Setup and cleanup errors propagate.
If setup throws, that plugin must unwind its partial allocations; the host disposes previously completed plugins.
Initialization failures later in startup also dispose installed plugins.

Keep browser dependencies in plugin factories rather than the shared setup context. A browser host can create
`createScreenshotPlugin({ canvas, renderFrame: () => editor.renderFrame() })` before initializing the editor; the
returned plugin captures those dependencies and uses the regular setup services. The render callback runs from
actions after initialization, once `editor` is available. Each editor receives a plugin bound to its own canvas.

Register menu items with `menus.registerItem('moduleMenu', provider)`. Providers receive the current
`{ state, codeBlock }` when the menu opens, and return a `ContextMenuItem` or `undefined` to omit it. The target block
can differ from the selection. Contributions appear in registration order after Enable/Disable. The item uses the
existing event dispatcher through its `action` and `payload`. Registration returns an unregister function.
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
- `pasteCodeBlocks` receives `{ x, y }` and reads the clipboard, including structured multi-block content.
- `insertCodeBlock` receives `{ x, y, code }` and inserts those source lines without reading the clipboard.

Coordinates are viewport pixels. Core applies unique naming, entry assignment, grid positioning, and persistence.
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
layout, including source, compiler metadata, info, font, and contribution changes. It returns an unsubscribe function.
Subscribers may update their requests; core finishes pending recalculations synchronously before notifying the render
projection. An unchanged submission is a no-op, allowing requests derived in subscriptions to settle without recursive
refresh loops. Keep widget data private and use the final geometry for both drawing and hit testing.

Subscribe and dispose explicitly. Unsubscribe before disposing a contribution so your callback cannot resubmit it.
Contribution changes preserve source, selection, project revision, and compiler input revision. Hidden project slices
use their requests when opened. The lazy loader only imports and installs plugins; it has no layout refresh policy.

Register drawers with `drawers.registerCodeBlockDrawer(drawer)`. The drawer receives
`{ draw, state, codeBlock, memoryViews }` once per visible block per frame. Coordinates are relative to that block;
the host applies viewport translation and visibility checks. Drawers run in registration order after error messages
and before built-in controls. Register overlays with `drawers.registerCodeBlockOverlay(drawer)` to draw after all
built-in block widgets, using the same context and coordinates. Each slot preserves registration order. Use the
drawing surface's text/fill primitives and shared numeric palette indices.
`@8f4e/web-ui` exports the drawing types. Registration returns an unregister function; call it from the plugin's
disposer. Each plugin owns its widget types and uses the drawing surface's sprite and text primitives.

Register canvas-wide GPU passes with `drawers.registerRenderLayer(factory)`. The factory receives `{ gl, palette }`
once the renderer is ready and returns `{ draw, destroy, loadPalette?, releaseMemory? }`. `draw` receives
`{ state, memoryViews }` every frame after sprites in registration order, independently of block culling.
Palette changes and memory release are forwarded to the layer. Registration may precede renderer initialization or
arrive later; unregistering destroys the active layer, and renderer disposal destroys all layers before its context.
Types and generic WebGL resource helpers are exported by `@8f4e/web-ui`.

`@8f4e/editor-plugin-connectors` owns input/output widgets and the complete wire renderer through these hooks.
Core keeps memory semantics independent of connector data and has no connector-specific fields or GPU resources.
`@8f4e/editor-plugin-texture-runtime` owns editor-frame WASM execution and block-bound `@texture` framebuffer views through the same overlay hook.

Interaction handlers can subscribe to `codeBlockPointerDown` for the start of a block press and `mouseup` for release.
Use `events.on('mousemove', handler, { capture: true })` when a plugin must consume a drag before ordinary listeners,
such as viewport panning. Capture listeners run first in registration order. Setting `event.stopPropagation = true`
stops the remaining capture and ordinary listeners. Unregister with the same `events.off` call as other listeners.
Core registers menu movement in capture before plugins, so an open menu retains priority over plugin drags.

Core dispatches `resolveCodeBlockDragTargets` with `{ codeBlock, altKey, targets: [codeBlock] }` before a drag.
Plugins may synchronously replace `targets`; core then moves and snaps those blocks and publishes one position edit.
Before inserting a clipboard batch, core dispatches `transformPastedCodeBlocks` with `{ blocks }`. Plugins may
replace that batch with transformed source, preserving the supplied input objects. Core resolves block names and
positions afterward. `@8f4e/editor-state` exports both event payload types and the generic `ClipboardCodeBlock` type.

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

The grouping plugin owns `; @group <name> [nonstick]`, private group membership, grouped dragging, paste collision
renaming, and all visual-group menu actions, including group execution toggling. Nested language-level project
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
memory loading, the loading dialog, and generated asset-size constants. Its factory receives a getter for current
runtime memory bytes; the shared plugin context carries no browser resources or binary asset fields.

Plugins can contribute source to the generated `env` constants block with
`store.set('envConstantContributions.myPlugin', ['const MY_VALUE 42'])`. Core combines contributed lines and recompiles when generated source changes. Each plugin removes its own contribution key
when disposed. The registry contains source lines only; feature metadata stays private to its owner.

`@8f4e/editor-state` exports shared source-edit, directive-argument, row-layout, text-wrapping, stack-value and info-value
formatting, tab-aware text measurement, module identity, and compiled-function lookup helpers. Info layout and drawing
share `isRenderableInfoValue` and `formatInfoValue`. Its `/memory` entry
exports memory scope, identifier, element-count, and typed-value resolution, plus `getMemoryDefaultEdits` for rewriting
resolved memory defaults in their source modules. Each group of values is edited together, even across module owners.
Plugins use these public exports rather than importing core files.
`serializeToProject` and `getExportBaseName` provide shared project-model serialization and naming;
`logError` records failures in the editor console. These helpers and filename configuration remain available
independently of the export and persistence plugins.
Project-model serialization lives under `pureHelpers/projectSerialization`; filename configuration belongs to
`features/editor-config`. The project-save plugin owns its private `.8f4e` text formatter.
`serializeToProject` and `serializeCodeBlocksToProject` return detached models with independent source arrays throughout
nested groups. Their fixed field order and grid/creation ordering support direct JSON comparison of canonical models.

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
`{ project }` later. Core loads initial content after the first resize and emits `init` once that content is installed.
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

- Global editor directives control editor presentation settings like `font` and color overrides.
- Runtime plugins own their independent `audioRuntime.enabled`, `workerRuntime.enabled`, `testRuntime.enabled`, and `textureRuntime.enabled` settings.
- Extensions can contribute schema-backed config roots; runtime packages use this for paths like `; @config audioRuntime.sampleRate 48000` and `; @config audioRuntime.audioOutBufferLAddress audioout:buffer`.
- `; @config export.fileName <value>` controls the base file name used by editor export actions.
- `; @config color.<path> <value>` controls base palette colors.
- `; @config textureRuntime.<field> <value>` configures the opt-in texture runtime, which controls entry execution once per editor frame. `; @textureUpload <address> <format> <width> <height>` declares a source, and `; @texture <address> <magnification> [<x> <y> <width> <height>]` displays a full or cropped view while reserving block space.
- Base colors accept hex with optional alpha, `rgb()` / `rgba()`, and `transparent`. The palette contains `canvas`,
  `surface`, `ink`, `muted`, `primary`, `secondary`, `tertiary`, `highlight`, `detail`, `stroke`, `positive`, `warning`,
  and `negative`. Optional accents preserve independently authored hues and opacity.
  All shades and fixed opacity variants are generated before atlas creation.

Example color overrides:

```txt
; @config color.canvas #660099
; @config color.surface #1a0b24
; @config color.ink #f6eff8
; @config color.primary #d9a6ff
```

- `docs/color-paths.md` - Configurable color paths for `; @config color.<path> <value>`.

## Font

Select the editor font with a global editor directive:

```txt
; @config font ibmvga8x16
```

Supported fonts: `6x10`, `ibmvga8x16`, `terminus8x16`, `terminus8x16bold`, `terminus10x18`, `terminus10x18bold`, `kana12x13`, `terminus12x24`, `terminus12x24bold`, `spleen5x8`, `spleen6x12`, `spleen8x16`, `templeos8x8`, `spleen12x24`, `spleen16x32`.

Runtime execution belongs to ordinary browser plugins. Each receives compiler getters through its factory, imports its own worker/worklet assets, contributes schemas and constants, and publishes its own info namespace. The audio plugin can borrow a host-supplied AudioContext. Runtimes can run concurrently; core owns no execution registry or selector. Memory-writing plugins receive a `writeMemory(address, value, isInteger)` function directly from their host.

Core emits `compilationInputChanged` after compilation inputs change. Install `@8f4e/editor-plugin-compiler` to schedule compilation and publish diagnostics, compiler metadata, and statistics. Core consumes its `compilationSucceeded` event with `ProgramArtifacts` (`memoryRef`) to update generic memory views. Public editor options no longer expose a callbacks bag; core constructs its internal browser callbacks. The compiler factory returns stable artifact getters and a memory writer for dependent feature and runtime plugins; core has no compile callback. Plugins dispose in reverse installation order, releasing runtime resources before their compiler dependency.

Plugins dispatch `memoryValuesChanged` when external execution changes memory, so core can refresh derived layout and rendering.
