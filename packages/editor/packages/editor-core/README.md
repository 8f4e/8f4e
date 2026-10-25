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

## State plugins

Pass a `plugins` array to initialization to install state-only extensions. `EditorStatePlugin` and
`EditorStatePluginContext` are exported by `@8f4e/editor-core` and `@8f4e/editor-state-types`.

```ts
import initEditor from '@8f4e/editor-core';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';

const editor = await initEditor(canvas, {
	...options,
	plugins: [toggleSkipExecutionPlugin],
});
```

A plugin declares a unique `id` and a synchronous `setup({ store, events, menus })` function.
The host installs plugins in array order after core effects, before rendering starts and before the `init` and
`loadSession` events. Setup runs separately for each editor instance; allocate instance data inside setup.
Plugins use the existing state manager and event dispatcher APIs. The plugin store omits the editor's `dispose`
method. This is a trusted extension interface, with the same state access as built-in effects.

State subscriptions, event listeners, and menu registrations made through the supplied context are cleaned up automatically.
Setup can return a function to release timers or other resources. Cleanup runs in reverse installation order,
once, while the store and dispatcher are still available. Failed setup releases subscriptions and previously
installed plugins before the error is propagated. Duplicate plugin IDs are rejected before setup.

Register a code-block menu item with `menus.registerItem('moduleMenu', provider)`. The provider receives the current
`{ state, codeBlock }` context whenever that menu is built, including submenu navigation. `codeBlock` is the block
the menu was opened for; it can differ from the current selection. Return a standard `ContextMenuItem`, or
`undefined` to hide the item. Its `action` and `payload` use the existing event dispatcher. The plugin owns the label,
visibility rules, target payload, and handler together.

Contributed items appear in registration order after Enable/Disable and before the remaining block actions.
Providers choose whether their item appears in view or edit mode. Registration returns an idempotent unregister
function and is also removed automatically with the plugin. Registrations belong to each editor instance and are
held outside the state tree.

The execution-toggle plugin registers its own Skip/Unskip menu item. Omitting the plugin removes both the item
and its handler. Group execution toggling remains built in. The core installs no state plugins by default;
`@8f4e/editor-default` selects the standard plugin set.

`@8f4e/editor-state` exports `setSkipExecution` for the source transformation shared by the plugin and group toggle,
and `incrementCompilerInputRevision` for signaling changed compiler inputs after source edits and derived updates.
State plugins currently have no renderer contributions or runtime installation/removal API.

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
