# Minimal Editor

`@8f4e/editor-minimal` composes the core editor for embedded examples, compiler tests, and landing-page demos.
It supports live compilation and interactive controls, loads project source from a URL, and uses its `@mode` directive
to select the initial mode (view by default).
Each mount starts fresh; it does not restore or save browser sessions.

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
The `@8f4e/editor-plugin-project-save` plugin saves the entire current project as `.8f4e` source. Export Project
chooses a destination; Cmd/Ctrl+S reuses it. The composition supplies the canvas and a per-editor
`@8f4e/editor-file-session`. Open From Disk belongs to the default composition.
Plot, wave, meter, bars, switch, button, piano, slider, crossfade, and audio/worker/test/texture runtimes load through the
project-signal registry in `src/lazy-plugins.ts`. MIDI input and binary assets also load through that registry when
raw `@config midi.*` or `@config bin.*` directives appear. Control factories receive the current editor's live memory
writer; MIDI receives its browser navigator and live compiler getters, binary assets receive a current-memory getter,
and runtime factories receive compiler artifacts and an optional shared `AudioContext`.

The loader checks cached directives automatically after project changes and group navigation. Visual/control plugins
use `view` scope: signals in unopened groups wait until that level is visited. Texture views load for `@texture` as well as `textureRuntime` configuration, using the existing overlay pass.
Runtime, MIDI, and asset plugins use
`project` scope and match signals across the complete project tree. Loaded plugins stay installed until disposal.
Imports and compilation finish independently of mounting and the initial-project callback. A callback may run before
the mount promise resolves.

Without `initialProjectUrl`, the editor starts with an empty project and calls `onInitialProjectLoaded` after core
initialization. A URL failure calls `onInitialProjectLoadError`. The host owns page URLs, loading/error UI, canvas
layout, visibility management, and any WebMCP bridge.

`MinimalEditorMountOptions` supports `initialProjectUrl`, the initial-project callbacks, `sharedAudioContext`,
`captureWheel`, and `featureFlags`. Project creation is disabled by default. A project selects its initial mode with
`; @mode edit` or `; @mode view` in a project block; without a valid, unique declaration it starts in view mode.
Hosts can override feature flags. Core retains project editing APIs, shared navigation operations, clipboard operations, and history. Keyboard bindings belong to plugins.

Keyboard behavior comes from three independent plugins: `keyboard-mode-switching` for `e`/Escape,
`keyboard-navigation` for line/block navigation and editing caret movement, and `keyboard-editing` for text changes
and undo/redo shortcuts. View mode supports line selection and block navigation, with history shortcuts left unhandled.
The editing plugin keeps a small input bridge and imports its text-editing implementation on first entry into edit
mode, including projects that start in edit mode. It buffers keys during that import and replays them in order.

The browser host imports and installs these plugins only when `(pointer: coarse)` does not match. Phones and tablets
with a coarse primary pointer receive none of the three plugins, and their mode overlay is hidden by default. This
is a capability check at mounting time; it does not identify devices by user agent. Touch navigation can be composed
separately later. Keyboard-to-memory and Save shortcuts remain independent plugins.

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
