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

Register menu items with `menus.registerItem('moduleMenu', provider)`. Providers receive the current
`{ state, codeBlock }` when the menu opens, and return a `ContextMenuItem` or `undefined` to omit it. The target block
can differ from the selection. Contributions appear in registration order after Enable/Disable. The item uses the
existing event dispatcher through its `action` and `payload`. Registration returns an unregister function.

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
current state's sprite lookups, which change with the font or color scheme.
`@8f4e/web-ui` exports the drawing types. Registration returns an unregister function; call it from the plugin's
disposer. Each plugin owns its widget types and uses the drawing surface's sprite and text primitives.

Interaction handlers can subscribe to `codeBlockPointerDown` for the start of a block press and `mouseup` for release.

The switch and button plugins own their directives, memory resolution, interaction, and drawing. Each keeps widget
data in a per-instance WeakMap. Buttons write their on value while pressed and their off value on release.
The execution-toggle plugin owns the Skip/Unskip menu item and its action. The tooltips plugin owns selected-line documentation, stack analysis, live memory values,
layout, animation, and overlay drawing, with its state private to each installation. Group execution toggling and
nested block shading remain built in. The core installs no plugins by default; `@8f4e/editor-default` selects the standard set.

`@8f4e/editor-state` exports shared source-edit, directive-argument, row-layout, text-wrapping, stack-value formatting,
and compiled-function lookup helpers. Its `/memory` entry
exports memory scope and identifier resolution. Plugins use these public exports rather than importing core files.

## Project loading

Hosts can provide `getProject(url)` for loading individual projects by URL and `importProject` for the Open From Disk
menu action. The `projectOpening` feature flag controls disk import. Example project browsing belongs to the host;
the editor no longer exposes a `getListOfProjects` callback or an example project submenu. Built-in module browsing
continues to use `getListOfModules` and `getModule`.

## Docs

- `docs/editor-directives.md` - Editor-only code-block directive syntax (`; @...`) and supported directives.

## Editor Config

Configure editor settings with `; @config <path> <value>`.

- Global editor directives control editor presentation settings like `font` and color overrides.
- `; @config runtime <runtimeId>` controls the runtime backend for the project.
- Extensions can contribute schema-backed config roots; runtime packages use this for paths like `; @config audioRuntime.sampleRate 48000` and `; @config audioRuntime.audioOutBufferLAddress audioout:buffer`.
- `; @config export.fileName <value>` controls the base file name used by editor export actions.
- `; @config color.<path> <value>` controls individual color scheme entries.
- `; @config webUI.overlay.<field> <value>` configures a WebAssembly-generated RGBA texture drawn over the editor.
- Color values should be valid color strings (for example `#101820` or `rgba(255,255,255,0.65)`).
- Main groups are `text`, `fill`, and `icons`.

Example color overrides:

```txt
; @config color.fill.moduleBackground #101820
; @config color.fill.wire rgba(255,255,255,0.65)
; @config color.text.instruction #b388ff
; @config color.icons.feedbackScale0 #ff0000
; @config color.icons.feedbackScale1 #cc0033
; @config color.icons.feedbackScale2 #990066
; @config color.icons.feedbackScale3 #660099
; @config color.icons.feedbackScale4 #3300cc
; @config color.icons.feedbackScale5 #0000ff
```

- `docs/color-paths.md` - Configurable color paths for `; @config color.<path> <value>`.

## Font

Select the editor font with a global editor directive:

```txt
; @config font ibmvga8x16
```

Supported fonts: `6x10`, `ibmvga8x16`, `terminus8x16`, `terminus8x16bold`, `terminus10x18`, `terminus10x18bold`, `kana12x13`, `terminus12x24`, `terminus12x24bold`, `spleen5x8`, `spleen6x12`, `spleen8x16`, `templeos8x8`, `spleen12x24`, `spleen16x32`.
