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
`@8f4e/editor-plugin-switch` for the switch widget, `@8f4e/editor-plugin-button` for momentary buttons,
and `@8f4e/editor-plugin-tooltips` for selected-line documentation, stack analysis, and live memory values. `defaultEditorPlugins` exports that plugin set.
The `plugins` option replaces it: pass `[]` to
omit plugins, or `[...defaultEditorPlugins, customPlugin]` to extend the defaults. Each editor installs and
disposes its own plugin effects. See the [plugin contract](../editor-core/README.md#plugins).

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
or `Ctrl+S` saves canonical `.8f4e` source to disk. In browsers supporting the File System Access API in a secure
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
