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
import { switchPlugin } from '@8f4e/editor-plugin-switch';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';

const editor = await initEditor(canvas, {
	...options,
	plugins: [toggleSkipExecutionPlugin, switchPlugin],
});
```

A plugin declares an `id` and a synchronous `setup({ store, events, menus, directives, drawers })` function.
Editor-core installs plugins in array order after core state effects, before rendering starts and before the `init`
and `loadSession` events. Setup runs separately for each editor instance; allocate instance data inside setup.
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

Register widget directives with `directives.register(definition)`, using the existing `EditorDirectiveDefinition`
contract from `@8f4e/editor-state-types`. The core owns generic source parsing, directive matching, and the block
layout pipeline. Each definition handles its own arguments through `apply`, registers `DirectiveLayoutCallbacks`
in `draft.layoutCallbacks`, and can clear its derived data through `clearDerivedBlockData`. These callbacks use
`onBlockLayoutReady` to derive geometry after the block's dimensions, display rows, gaps, and cursor coordinates are
current. Registrations are local to each editor. Install them in setup before the initial project loads; there is
no runtime plugin installation API.

Register drawers with `drawers.registerCodeBlockDrawer(drawer)`. The drawer receives
`{ draw, state, codeBlock, memoryViews }` once per visible block per frame. Coordinates are relative to that block;
the host applies viewport translation and visibility checks. Drawers run in registration order after error messages
and before built-in controls. Register overlays with `drawers.registerCodeBlockOverlay(drawer)` to draw after all
built-in block widgets, using the same context and coordinates. Each slot preserves registration order. Use the
drawing surface's text/fill primitives and shared numeric palette indices.
`@8f4e/web-ui` exports the drawing types. Registration returns an unregister function; call it from the plugin's
disposer. Each plugin owns its widget types and uses the drawing surface's sprite and text primitives.

Interaction handlers can subscribe to `codeBlockPointerDown` for the start of a block press and `mouseup` for release.
Use `events.on('mousemove', handler, { capture: true })` when a plugin must consume a drag before ordinary listeners,
such as viewport panning. Capture listeners run first in registration order. Setting `event.stopPropagation = true`
stops the remaining capture and ordinary listeners. Unregister with the same `events.off` call as other listeners.
Core registers menu movement in capture before plugins, so an open menu retains priority over plugin drags.

The switch and button plugins own their directives, memory resolution, interaction, and drawing. Each keeps widget
data in a per-instance WeakMap. Buttons write their on value while pressed and their off value on release.
The wave plugin owns `@wave`, `@wave2`, and `@wave4`, including their layout space, typed samples, playheads, and drawing.
The piano plugin owns `@piano`, key geometry, runtime note toggling, drawing, and its save-to-code menu action.
The slider plugin owns `@slider`, its geometry, drag interaction, live drawing, and save-to-code menu action.
Meter, plot, and bars plugins own their typed-memory visualization and layout. Crossfade owns its float-memory
interaction and drawer. Watch and stack own separate inline value overlays; their factories receive a
`prefersReducedMotion` function from the host. None of these features adds fields to core code-block state.
The screenshot plugin owns the main-menu action, temporary overlay visibility, PNG encoding, and browser file saving.
The project-export plugin owns project Save/Export actions, its main-menu item, and the Cmd/Ctrl+S listener on its
injected `inputTarget`. Its save/export functions come from the browser host. The WebAssembly-export plugin owns
its main-menu item and action, with file writing supplied by the host.
The execution-toggle plugin owns the Skip/Unskip menu item and its action. The tooltips plugin owns selected-line documentation, stack analysis, live memory values,
layout, animation, and overlay drawing, with its state private to each installation. Group execution toggling and
nested block shading remain built in. The core installs no plugins by default; `@8f4e/editor-default` selects the standard set.

The favorite-toggle plugin owns Favorite/Unfavorite editing and its block-menu item. Favorite directive derivation
and Jump to navigation remain in core. The memory-connection-removal plugin owns its block-menu item, enabled
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
`store.set('envConstantContributions.myPlugin', ['const MY_VALUE 42'])`. Core combines these lines with the selected
runtime's constants and recompiles when generated source changes. Each plugin removes its own contribution key
when disposed. The registry contains source lines only; feature metadata stays private to its owner.

`@8f4e/editor-state` exports shared source-edit, directive-argument, row-layout, text-wrapping, stack-value formatting,
tab-aware text measurement, module identity, and compiled-function lookup helpers. Its `/memory` entry
exports memory scope, identifier, element-count, and typed-value resolution, plus `getMemoryDefaultEdits` for rewriting
resolved memory defaults in their source modules. Each group of values is edited together, even across module owners.
Plugins use these public exports rather than importing core files.
`serializeToProject`, `serializeProjectTo8f4e`, and `getExportBaseName` provide shared project serialization and naming;
`logError` records failures in the editor console. These helpers, filename configuration, and session autosaving
remain available independently of the export plugins.
Serialization lives under `pureHelpers/projectSerialization`; filename configuration belongs to `features/editor-config`.

## Project loading

Hosts can provide `getProject(url)` for loading individual projects by URL and `importProject` for the Open From Disk
menu action. The `projectOpening` feature flag controls disk import. Example project browsing belongs to the host;
the editor no longer exposes a `getListOfProjects` callback or an example project submenu. Built-in module browsing
belongs to `@8f4e/editor-plugin-example-modules`, whose factory receives lazy source loaders from the host. The plugin
owns categories, caching, public-block selection, and dependency insertion; core retains generic menus and block creation.

## Docs

- `docs/editor-directives.md` - Editor-only code-block directive syntax (`; @...`) and supported directives.

## Editor Config

Configure editor settings with `; @config <path> <value>`.

- Global editor directives control editor presentation settings like `font` and color overrides.
- `; @config runtime <runtimeId>` controls the runtime backend for the project.
- Extensions can contribute schema-backed config roots; runtime packages use this for paths like `; @config audioRuntime.sampleRate 48000` and `; @config audioRuntime.audioOutBufferLAddress audioout:buffer`.
- `; @config export.fileName <value>` controls the base file name used by editor export actions.
- `; @config color.<path> <value>` controls base palette colors.
- `; @config webUI.overlay.<field> <value>` configures a WebAssembly-generated RGBA texture drawn over the editor.
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
