# Minimal Editor

`@8f4e/editor-minimal` composes the core editor for embedded examples and compiler tests.
It supports live compilation and interactive controls, loads project source from a URL, and uses its `@mode` directive
to select the initial mode (view by default).
Each mount starts fresh; it does not restore or save browser sessions.
The product landing page uses [`@8f4e/editor-landing`](../editor-landing/README.md), which omits entry outlines,
offscreen block arrows, context menus, project saving/export, file-session tracking, and block copy/paste.

```ts
import { mountMinimalEditor } from '@8f4e/editor-minimal';

const editor = await mountMinimalEditor(canvas, {
	initialProjectUrl: '/examples/demo.8f4e',
	captureWheel: false,
	onInitialProjectLoaded: () => canvas.classList.add('editor-ready'),
});

editor.dispose();
```

The composition installs the compiler first, with lazy standard-library include resolution. It includes project URL
loading, project source saving/export, keyboard input, assertion markers, watch and stack annotations, and tooltips.
Compiler coordination, file-session tracking, URL loading, block backgrounds, code rendering, and loading indicators are eager.
`code-block-background` registers before `code-rendering` so block surfaces sit below text and line highlighting.
On core's `ready` event, a deferred loader imports `src/deferred-plugins.ts` for input, connectors, assertion markers, saving, tooltips, and
the directive-based loader. Core emits this event after initial project loading/parsing, font-atlas loading, and
rendering. This is the single loading gate, with no extra frame callback or timer. Optional features initialize from the
current project and do not block the first render, mounting, or initial-project callbacks. Every optional feature is an individual entry in the
same deferred list, including input plugins; their implementations load independently. This boundary also gates all
directive-based lazy imports. The renderer loads its initial font before drawing, and font payloads remain separate
lazy chunks.
The `@8f4e/editor-plugin-project-save` plugin saves the entire current project as `.8f4e` source. Export Project
chooses a destination; Cmd/Ctrl+S reuses it. The composition supplies the canvas and a per-editor
`@8f4e/editor-file-session`. Open From Disk belongs to the default composition.
Plot, wave, meter, bars, watch, stack, switch, button, piano, slider, crossfade, and audio/worker/test/texture runtimes load through the
project-signal registry in `src/lazy-plugins.ts`. Watch matches `@watch`/`@w`, and stack matches `@stack`/`@s`.
Both receive a live reduced-motion preference. Block drawers run in registration order, including later lazy installations.
MIDI input and binary assets also load through that registry when
raw `@config midi.*` or `@config bin.*` directives appear. Control factories receive the current editor's live memory
writer; MIDI receives its browser navigator and live compiler getters, binary assets receive a current-memory getter,
and runtime factories receive compiler artifacts and an optional shared `AudioContext`.

The optional `@8f4e/editor-plugin-selection-animation` draws the circling segment around the selected block. Its entry
is commented out in this composition. Core retains selection state; the background plugin owns corner markers and code rendering owns line highlighting.

`@8f4e/editor-plugin-error-messages` loads in the deferred set. It wraps and draws raw contributor-owned errors from
core's `state.codeErrors`, reserving their source rows through the generic layout API.

`@8f4e/editor-plugin-loading-indicators` is installed eagerly before deferred loading and draws the unified
`state.loadingIndicators` list at the bottom left. Lazy plugin imports and binary assets contribute names while
loading; binary assets remain listed until their bytes reach every configured target. This overlay does not block input.

The loader checks cached directives automatically after project changes and group navigation. Visual/control plugins
use `view` scope: signals in unopened groups wait until that level is visited. Texture views load for `@texture` as well as `textureRuntime` configuration, using the existing overlay pass.
Runtime, MIDI, and asset plugins use
`project` scope and match signals across the complete project tree. Loaded plugins stay installed until disposal.
Imports and compilation finish independently of mounting and the initial-project callback. A callback may run before
the mount promise resolves. Mounting waits for URL fetching/parsing, font-atlas loading, and the first render. Project
fetching/parsing and the default ibmvga font download run in parallel.

Without `initialProjectUrl`, the editor starts with an empty project and calls `onInitialProjectLoaded` after core
initialization. A URL failure calls `onInitialProjectLoadError`. The host owns page URLs, loading/error UI, canvas
layout, visibility management, and any WebMCP bridge.

`MinimalEditorMountOptions` supports `initialProjectUrl`, the initial-project callbacks, `sharedAudioContext`,
`captureWheel`, `touchNavigation`, `includeKeyboardModeSwitching`, and `featureFlags`. Project creation is disabled by default. A project selects its initial mode with
`; @mode edit` or `; @mode view` in a project block; without a valid, unique declaration it starts in view mode.
Set `includeKeyboardModeSwitching: false` to omit the mode-switching plugin and its hint; project mode still comes
from the source declaration. Hosts can override generic feature flags. Core retains project editing APIs, shared navigation operations, and history. Keyboard bindings belong to plugins.

Keyboard behavior comes from three independent plugins: `keyboard-mode-switching` for `e`/Escape,
`keyboard-navigation` for view-mode line selection and block navigation, and `keyboard-editing` for caret movement,
text changes, and undo/redo shortcuts. View mode supports line selection and block navigation, with history shortcuts left unhandled.
The editing plugin keeps a small input bridge and imports its text-editing implementation on first entry into edit
mode, including projects that start in edit mode. It buffers keys during that import and replays them in order.

After the first render, the browser host imports and installs these plugins only when `(pointer: coarse)` does not match. Phones and tablets
with a coarse primary pointer receive none of the three plugins, and their mode overlay is hidden by default. This
is a capability check when the deferred registry is created; it does not identify devices by user agent.
Coarse-pointer devices load `touch-input` for configurable viewport dragging and grid snapping. Taps
remain available to controls, and dragging does not edit block positions.

Touch panning uses one finger in both directions by default. Set `touchNavigation: { axis: 'horizontal' }`
to let horizontal drags pan the editor while vertical swipes scroll the surrounding page, as on the product landing
page and galleries. `axis` accepts `'both'`, `'horizontal'`, or `'vertical'`. Controls use shared editor pointer events
and keep their gestures separate from viewport panning.

The independent `mouse-input` plugin loads on all devices to forward mouse and wheel input, including the mouse events
generated by touch taps. The host's `captureWheel` option configures this plugin; core has no wheel-capture option or
DOM input listeners. Keyboard-to-memory loads only for raw `@config keyboard.*` directives throughout the project,
including unopened groups and configuration added during editing. Save shortcuts remain an independent plugin.

This package has its own composition and dependencies. The full `@8f4e/editor-default` composition provides session
persistence, Open From Disk, WASM exports, screenshots, built-in module browsing, and additional editing actions such as
visual grouping, execution toggles, favorites navigation/editing, and memory disconnection.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-minimal:build
npx nx run @8f4e/editor-minimal:test
npx nx run @8f4e/editor-minimal:typecheck
npx nx run @8f4e/8f4e-website:test:browser
```

Block copy/paste is provided by `@8f4e/editor-plugin-code-block-copy-paste`, loaded independently in the deferred set. The host injects its browser clipboard reader/writer; grouping receives its own writer. Paste Code Block places sources at the menu location, changing only `@pos`. Declaration names, group names, and references stay intact. Ctrl/Cmd+V in keyboard editing inserts plain text at the caret, including multiple lines; paste is not buffered during loading.

Context-menu presentation comes from the deferred `@8f4e/editor-plugin-context-menu`. It owns decorated labels,
geometry, hover/hit testing, and drawing. Core keeps raw menu contributions, navigation, input blocking, and action
or selector dispatch. Menu geometry is private; consumers activate raw items through `activateContextMenuItem`.

`@8f4e/editor-plugin-offscreen-block-arrows` loads after `ready` and owns viewport-edge arrow placement and drawing.
Web-ui calls its single replaceable drawer from the existing block traversal.

`@8f4e/editor-plugin-entry-outlines` is also deferred until `ready`. It draws borders and labels below code blocks
from core's entry bounds. Editor-state owns bounds, updates, and insertion assignment, independently of presentation.
