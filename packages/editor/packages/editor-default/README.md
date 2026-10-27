# Default Editor

`@8f4e/editor-default` is the standard 8f4e editor composition. It connects `@8f4e/editor-core` to the compiler
worker, runtime implementations, standard library, the example module registry, and browser persistence.

The package exports `mountDefaultEditor(canvas, options)`. It does not mount itself when imported, so websites and
other browser hosts control when and where the editor starts.

```ts
import { mountDefaultEditor } from '@8f4e/editor-default';

const editor = await mountDefaultEditor(canvas, {
	captureWheel: false,
	initialEditorMode: 'edit',
	storageNamespace: 'editor-a',
});

editor.state;
editor.releaseRenderingResources();
editor.resumeRendering();
editor.dispose();
```

Use `initialEditorMode: 'edit'` to start editing immediately. Set the `modeToggling` feature flag to `false` when the
host should keep the editor in its initial mode.

`releaseRenderingResources()` pauses rendering and releases reloadable GPU textures, dynamic buffer storage, and the
canvas drawing buffer. `resumeRendering()` restores the resources, applies the latest canvas size, and renders
immediately.

The host controls the canvas's layout dimensions with CSS. The editor observes that rendered size and adapts its
drawing buffer and UI automatically. Wheel input pans the editor and prevents page scrolling by default; embedded
hosts can pass `captureWheel: false` to leave scrolling to the page.

Each mounted editor owns its compiler worker, compiled memory and code-buffer state, and lazy runtime registry.
It also owns persistence callbacks for its storage namespace. The default namespace is `editor`, which uses the
`project_editor` key. Hosts mounting multiple editors should pass a stable, unique namespace for each editor.
Hosts may also provide a custom `Storage` implementation or an
`initialProjectUrl`; interpreting page URLs remains the host's responsibility.

The default composition includes `@8f4e/editor-plugin-toggle-skip-execution` for the module menu's Skip/Unskip action,
`@8f4e/editor-plugin-toggle-favorite` for Favorite/Unfavorite editing,
`@8f4e/editor-plugin-remove-memory-connections` for disconnecting intermodular memory defaults,
`@8f4e/editor-plugin-switch` for the switch widget, `@8f4e/editor-plugin-button` for momentary buttons,
`@8f4e/editor-plugin-wave` for waveform displays, `@8f4e/editor-plugin-piano` for piano keyboards,
`@8f4e/editor-plugin-slider` for sliders,
`@8f4e/editor-plugin-tooltips` for selected-line documentation,
stack analysis, and live memory values, `@8f4e/editor-plugin-screenshot` for PNG screenshots,
`@8f4e/editor-plugin-project-export` for project Save/Export, and `@8f4e/editor-plugin-wasm-export` for WebAssembly export.
`createDefaultEditorPlugins({ canvas, renderFrame, saveProject, exportProject, exportBinaryCode, getMemory, getCodeBuffer })` constructs this
plugin set with resources for one editor. Project save/export callbacks share the file service used by Open;
the WebAssembly callback reads the compiler's current code buffer when invoked.
The render callback runs from plugin actions after initialization. The shared plugin setup context contains no
browser resources; browser dependencies are supplied to plugin factories by this composition.
Meter, plot, bars, crossfade, watch, and stack are also optional plugins in this standard set. Watch and stack receive
a live reduced-motion preference from the browser host and keep their animation and data inside their installations.
The `plugins` option replaces the default set: pass `[]` to omit plugins, or a custom array to select and extend it.
Each editor installs and disposes its own plugin effects. See the [plugin contract](../editor-core/README.md#plugins).

`@8f4e/editor-plugin-binary-assets` is also included. It owns binary asset configuration, fetching, caching, memory
copies, loading UI, and generated size constants. The default editor supplies a getter for current compiler memory
bytes, so memory replacement and growth are visible to the plugin without sharing browser-specific context fields.

The standard set includes `@8f4e/editor-plugin-assertion-markers` for executed assertion indicators,
`@8f4e/editor-plugin-keyboard-memory` for keyboard-to-memory input, and `@8f4e/editor-plugin-midi-input` for MIDI
discovery and callbacks. Keyboard input receives the mounted canvas. MIDI receives that canvas's navigator and
live compiler memory/bytecode getters, and owns its WASM instance and export cache. MIDI access is requested only
when the project has MIDI configuration. Omitting these plugins also omits their schemas and input listeners.

The runtime registry includes `TestRuntime`, selected with `; @config runtime TestRuntime`. For projects with an
enabled test entry, it executes tests once after successful compilation or recompilation, using the editor's current
memory and publishing results under `state.runtime.values.TestRuntime`. See the
[test runtime](../runtime-test-runner/README.md) for scheduling and memory ownership.

An explicit `initialProjectUrl` takes precedence on the first load, followed by the saved session. With neither,
the editor starts with an empty project and does not fetch an example project registry. Browse examples in the
[examples gallery](https://8f4e.com/examples/); its links open projects by URL. The editor's menu supports opening
projects from disk and adding built-in modules.

Built-in modules and standard-library includes ship as lazy source chunks with the host's build. The module menu's
catalog is derived from source paths without loading module text. Selecting a module loads its source on demand;
module dependencies are resolved through the same local catalog.

Code changes automatically save a recovery session to browser storage. With the editor canvas focused, `Cmd+S`
or `Ctrl+S` saves canonical `.8f4e` source to disk through the project-export plugin. In browsers supporting the File System Access API in a secure
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
