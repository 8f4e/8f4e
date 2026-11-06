# Landing Editor

`@8f4e/editor-landing` composes the editor for interactive landing-page demos. It provides the same live editing,
compiler, URL loading, standard-library includes, controls, visualizations, and runtimes as
[`@8f4e/editor-minimal`](../editor-minimal/README.md), while omitting entry outlines, offscreen block arrows,
context-menu presentation, project saving/export, file-session tracking, block copy/paste, and loading indicators. Context-menu requests
are disabled so an invisible menu cannot block input.

```ts
import { mountLandingEditor } from '@8f4e/editor-landing';

const editor = await mountLandingEditor(canvas, {
	initialProjectUrl: '/examples/demo.8f4e',
	captureWheel: false,
	touchNavigation: { axis: 'horizontal' },
	includeKeyboardModeSwitching: false,
});

editor.dispose();
```

`LandingEditorMountOptions` accepts the same host options as `MinimalEditorMountOptions`. Project creation defaults
to disabled; context menus are always disabled. Initial project callbacks, rendering controls, compiler diagnostics,
and disposal follow the minimal editor's lifecycle. Each mount starts fresh without browser session persistence.

The compiler, URL loader, block backgrounds, and code rendering load eagerly. Core's `ready` event
gates all optional imports through `src/deferred-plugins.ts`. `src/lazy-plugins.ts` matches visual/control plugins
in the current view and runtimes, MIDI, and binary assets throughout the project. Font payloads remain lazy.
Keyboard-to-memory input also loads with project scope, only when raw `@config keyboard.*` directives appear.
Keyboard input follows pointer capabilities; the host owns scrolling, visibility, loading UI, and canvas layout.
Plain-text paste at the caret remains available through keyboard editing. The composition does not intercept
Cmd/Ctrl+S. The galleries continue to use `editor-minimal` with entry outlines, arrows, context menus, project
saving/export, and block copy/paste.

The composition omits `@8f4e/editor-plugin-loading-indicators`; the host owns loading UI. Producers still publish
operation status in `state.loadingIndicators`, and completed records remain in state. No indicator drawer or
visibility timer is installed.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-landing:build
npx nx run @8f4e/editor-landing:test
npx nx run @8f4e/editor-landing:typecheck
npx nx run @8f4e/8f4e-website:test:browser
```

Block authoring menu commands are omitted: this composition does not import or depend on `@8f4e/editor-plugin-block-authoring`. Core editing APIs remain available.
