# Default Editor

`@8f4e/editor-default` is the standard 8f4e editor composition. It connects `@8f4e/editor-core` to the compiler
plugin, runtime implementations, standard library, example source discovery, and startup policy.

The package exports `mountDefaultEditor(canvas, options)`. It does not mount itself when imported, so websites and
other browser hosts control when and where the editor starts.

For embedded examples, compiler tests, and landing-page demos, use
[`@8f4e/editor-minimal`](../editor-minimal/README.md). It keeps live editing, runtime controls, and visualizations
and starts each mount fresh, with a smaller feature set and no session storage.

```ts
import { mountDefaultEditor } from '@8f4e/editor-default';

const editor = await mountDefaultEditor(canvas, {
	captureWheel: false,
	storageNamespace: 'editor-a',
});

editor.state;
editor.releaseRenderingResources();
editor.resumeRendering();
editor.dispose();
```

Declare `; @mode edit` or `; @mode view` in a project block to select its mode when loaded. Projects without a valid,
unique declaration start in view mode. Set the `modeToggling` feature flag to `false` to hide the user controls for
changing modes. The directive still selects the initial mode when these controls are disabled.

`releaseRenderingResources()` pauses rendering and releases reloadable GPU textures, dynamic buffer storage, and the
canvas drawing buffer. `resumeRendering()` restores the resources, applies the latest canvas size, and renders
immediately.

The host controls the canvas's layout dimensions with CSS. The editor observes that rendered size and adapts its
drawing buffer and UI automatically. Wheel input pans the editor and prevents page scrolling by default; embedded
hosts can pass `captureWheel: false` to leave scrolling to the page.

Each mounted editor owns its compiler worker, compiled memory and code-buffer state, and lazy plugin installations.
The session-persistence plugin uses its storage namespace. The default namespace is `editor`, which uses the
`project_editor` key. Hosts mounting multiple editors should pass a stable, unique namespace for each editor.
Hosts may also provide a custom `Storage` implementation or an
`initialProjectUrl`; interpreting page URLs remains the host's responsibility.

Use `onInitialProjectLoaded()` to reveal installed initial content and `onInitialProjectLoadError(error)` to report
a failed initial URL request or parse. With no URL, the success callback runs after editor initialization and synchronous
session restoration. With a URL, the standard URL-loader plugin supplies the notification. A valid empty project counts
as success; compilation and asset loading continue independently.

Callbacks can run before the mount promise resolves. Mounting itself finishes after editor initialization while a URL
request may still be pending, so hosts can dispose that editor when navigating elsewhere. Custom plugin compositions
provide their own asynchronous loading notifications.

The default composition constructs `@8f4e/editor-plugin-compiler` first and passes its artifact getters and memory writer to dependent plugins and runtimes. Its plugin is installed first. The feature set includes `@8f4e/editor-plugin-toggle-skip-execution` for the module menu's Skip/Unskip action,
`@8f4e/editor-plugin-favorites` for favorite directives, editing, and navigation,
`@8f4e/editor-plugin-grouping` for visual `@group` membership, dragging, paste renaming, and group menus,
`@8f4e/editor-plugin-remove-memory-connections` for disconnecting intermodular memory defaults,
`@8f4e/editor-plugin-switch` for the switch widget, `@8f4e/editor-plugin-button` for momentary buttons,
`@8f4e/editor-plugin-wave` for waveform displays, `@8f4e/editor-plugin-piano` for piano keyboards,
`@8f4e/editor-plugin-slider` for sliders,
`@8f4e/editor-plugin-tooltips` for selected-line documentation,
stack analysis, and live memory values, `@8f4e/editor-plugin-screenshot` for PNG screenshots,
`@8f4e/editor-plugin-project-files` for project Open/Save, `@8f4e/editor-plugin-project-export` for source export, and `@8f4e/editor-plugin-wasm-export` for WebAssembly export.
`createDefaultEditorPlugins({ canvas, storage, storageKey, initialProjectUrl, showOpenMenuItem, renderFrame, getMemory, getCodeBuffer, writeMemory })`
constructs this plugin set with resources for one editor. It creates one `@8f4e/editor-file-session`, installs its
plugin before project loaders, and supplies it to Open/Save and Export. That session shares the current destination
and pending write state, so Export selects the file used by subsequent saves. Each file plugin serializes its own
project and passes a Blob and filename to the shared browser writer. Open derives browser resources from the
canvas; WebAssembly export receives its document and a live compiler-byte getter. File handling stays outside core.
The render callback runs from plugin actions after initialization. The shared plugin setup context contains no
browser resources. This composition supplies resources tied to the host, while browser plugins can own their
browser API use.
Meter, bars, crossfade, watch, and stack are also optional plugins in this standard set. Watch and stack remain fixed
and register their overlays before tooltips. They receive a live reduced-motion preference from the browser host
and keep their animation and data inside their installations.
Plot, wave, meter, bars, switch, button, piano, slider, and crossfade load on demand through
`@8f4e/editor-plugin-lazy-loader`. The per-editor registry in `src/lazy-plugins.ts` matches cached parsed directives
and dynamically imports their implementations. Wave matches `@wave`, `@wave2`, and `@wave4`.
MIDI input and binary assets load when raw `@config midi.*` or `@config bin.*` directives appear, before their
schemas are registered. The registry supplies the canvas's navigator and live compiler getters to those factories,
and the compiler's live memory writer to control factories after importing them.
The loader scans automatically after project changes, including typing, paste, undo/redo, URL and session loads.
Visual/control plugins use `view` scope and load when their signals appear in the current project level, including
after entering a group. Runtime, MIDI, and asset plugins use `project` scope and match signals throughout nested groups.
Imports finish in the background; mounting and initial-project notifications do not wait for them. A loaded plugin stays installed until editor disposal. See the [loader contract](../../plugins/lazy-loader/README.md).
The `plugins` option replaces the default feature set: pass `[]` to omit feature plugins, or a custom array to select and extend it. The compiler remains installed first. Use `initEditor` from editor-core for a composition without a compiler or with a different compiler plugin.
Each editor installs and disposes its own plugin effects. See the [plugin contract](../editor-core/README.md#plugins).

`@8f4e/editor-plugin-binary-assets` loads on demand from `bin` configuration. It owns fetching, caching, memory
copies, loading UI, and generated size constants. The default editor supplies a getter for current compiler memory
bytes, so memory replacement and growth are visible to the plugin without sharing browser-specific context fields.

The fixed set includes `@8f4e/editor-plugin-assertion-markers` for executed assertion indicators and
`@8f4e/editor-plugin-keyboard-memory` for keyboard-to-memory input. The lazy `@8f4e/editor-plugin-midi-input` owns MIDI
discovery and callbacks. Keyboard input receives the mounted canvas and a live memory writer. MIDI receives that canvas's navigator and
live compiler memory/bytecode getters, and owns its WASM instance and export cache. MIDI access is requested only
when the project has MIDI configuration. Omitting these plugins also omits their schemas and input listeners.

The lazy test-runtime plugin is enabled with `; @config testRuntime.enabled true`. For projects with an
enabled test entry, it executes tests once after successful compilation or recompilation, using the editor's current
memory and publishing results under `state.info.testRuntime`. See the
[test runtime plugin](../../plugins/test-runtime/README.md) for scheduling and memory ownership.

The default plugin set includes project URL loading and session persistence. It passes `fetch` and the optional
`initialProjectUrl` to the URL loader, and storage, a namespaced key, and `restoreOnStartup: !initialProjectUrl` to
session persistence. Explicit URL loading disables only restoration; autosaving continues while fetching. An empty
session may therefore be saved before the URL resolves, and remains if the load fails or the editor closes early.
Omitting either plugin also omits that feature. Neither requires a session or URL callback in core.

An explicit `initialProjectUrl` takes precedence on the first load. Without one, the editor restores the saved
session. With neither, it starts with an empty project and does not fetch an example project registry. Browse examples in the
[examples gallery](https://8f4e.com/examples/); its links open projects by URL. The editor's menu supports opening
projects from disk and adding built-in modules. Set `showOpenMenuItem: false` to hide Open From Disk in embedded editors.

Built-in modules and standard-library includes ship as lazy source chunks with the host's build. The default editor
passes its discovered module loaders to `createExampleModulesPlugin({ sources })`. That plugin derives the catalog
from paths without loading module text, owns the menu and source cache, and inserts selected public blocks with their
dependencies. Omitting it removes the module browser. Standard-library include resolution remains in the host.

Code changes automatically save a recovery session to browser storage. With the editor canvas focused, `Cmd+S`
or `Ctrl+S` saves canonical `.8f4e` source to disk through the project-files plugin. In browsers supporting the File System Access API in a secure
context, the first Save chooses a destination and later saves reuse it. Opening a project from disk associates the
selected file with the editor; the first Save can ask for write permission. The Export Project menu action acts as
Save As: it chooses a destination and makes that file the target of later saves.

Each mounted editor retains its own file association for the current page lifetime. Reloading the page loses the
association, while the browser recovery session remains available. Loading a new project, a URL/example, or a
restored session clears the association. Edits, navigation, undo, and redo keep it. Cancelling a picker leaves the
project and prior association intact. Filesystem saves run in command order, independently of session autosave.
An accepted save finishes with its captured source and destination even if the editor switches projects or is
disposed. Its destination becomes the active file only if the same project is still loaded.

Browsers without the picker APIs use file uploads for Open and downloads for Save/Export. An uploaded file has no
writable association; saving chooses a destination if the save picker is available, or downloads a new file.

Build, test, and type-check it from the workspace root:

```bash
npx nx run @8f4e/editor-default:build
npx nx run @8f4e/editor-default:test
npx nx run @8f4e/editor-default:typecheck
```

The compiler plugin receives the stdlib include resolver when it is created; editor state does not forward compiler or include-loading callbacks. Button, switch, slider, piano, crossfade, and keyboard-memory factories receive the compiler plugin's live `writeMemory` function directly. Audio, worker, test, and texture runtime plugins load through the ordinary lazy registry and own independent execution lifecycles.

The public editor API has no callbacks bag. Core announces input changes through `compilationInputChanged`. The compiler plugin owns debouncing, worker communication, stale-result rejection, diagnostics, and statistics. It contributes the `recompileDebounceDelay` directive schema through the shared config mechanism and emits accepted memory and bytecode through `compilationSucceeded`, which core consumes to update its views before dependent features and runtimes react to metadata. Runtime plugins release their resources during plugin disposal; the compiler then cancels scheduling and terminates its worker after dependent plugins have shut down. Worker results carry current artifacts and memory actions without redundant byte-size or instance-reset flags.

Runtime plugins activate from `audioRuntime`, `workerRuntime`, or `testRuntime` configuration roots. Each has an
`enabled` setting, defaulting to false; several may be enabled together. The host injects live compiler getters and
an optional shared AudioContext. Each plugin imports its own worker/worklet assets from the separate execution
packages and owns browser API use and resource cleanup. Their fixed info namespaces match their config roots.

```text
; @config audioRuntime.enabled true
; @config audioRuntime.sampleRateConstantName SAMPLE_RATE
; @config workerRuntime.enabled true
; @config workerRuntime.sampleRateConstantName CONTROL_RATE
```

Audio's buffer-size constant name is configured with `audioRuntime.bufferSizeConstantName` (default
`AUDIO_BUFFER_SIZE`). The sample-rate default is `SAMPLE_RATE` for each runtime; use different names when enabling
both. There is no runtime registry option or exclusive runtime selection in core.
