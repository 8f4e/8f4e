# Minimal Editor

`@8f4e/editor-minimal` composes the core editor for embedded examples, compiler tests, and landing-page demos.
It starts in edit mode, supports live compilation and interactive controls, and loads project source from a URL.
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
loading, binary assets, keyboard and MIDI input, assertion markers, watch and stack annotations, and tooltips.
Plot, wave, meter, bars, switch, button, piano, slider, crossfade, and audio/worker/test runtimes load through the
project-signal registry in `src/lazy-plugins.ts`. Control factories receive the current editor's live memory writer;
runtime factories receive its compiler artifacts and an optional shared `AudioContext`.

Project loading scans for plugin signals automatically. After introducing a new directive by editing or pasting,
use **Load plugins used by project** in the background menu. Imports and compilation finish independently of
mounting and the initial-project callback. A callback may run before the mount promise resolves.

Without `initialProjectUrl`, the editor starts with an empty project and calls `onInitialProjectLoaded` after core
initialization. A URL failure calls `onInitialProjectLoadError`. The host owns page URLs, loading/error UI, canvas
layout, visibility management, and any WebMCP bridge.

`MinimalEditorMountOptions` supports `initialProjectUrl`, the initial-project callbacks, `sharedAudioContext`,
`captureWheel`, `featureFlags`, and `initialEditorMode`. Project creation is disabled by default. Hosts can override
feature flags or select view mode. Core still owns ordinary editing, navigation, clipboard operations, and history.

This package has its own composition and dependencies. The full `@8f4e/editor-default` composition provides session
persistence, file and WASM exports, screenshots, built-in module browsing, and additional editing actions such as
visual grouping, execution/favorite toggles, and memory disconnection.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-minimal:build
npx nx run @8f4e/editor-minimal:test
npx nx run @8f4e/editor-minimal:typecheck
npx nx run @8f4e/8f4e-website:test:browser
```
