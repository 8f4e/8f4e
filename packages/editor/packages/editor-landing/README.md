# Landing Editor

`@8f4e/editor-landing` composes the editor for interactive landing-page demos. It provides the same live editing,
compiler, URL loading, standard-library includes, controls, visualizations, and runtimes as
[`@8f4e/editor-minimal`](../editor-minimal/README.md), while omitting entry outlines, offscreen block arrows,
context-menu presentation, project saving/export, file-session tracking, and block copy/paste. Context-menu requests
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

The compiler, URL loader, block backgrounds, code rendering, and loading indicators load eagerly. Core's `ready` event
gates all optional imports through `src/deferred-plugins.ts`. `src/lazy-plugins.ts` matches visual/control plugins
in the current view and runtimes, MIDI, and binary assets throughout the project. Font payloads remain lazy.
Keyboard-to-memory input also loads with project scope, only when raw `@config keyboard.*` directives appear.
Keyboard input follows pointer capabilities; the host owns scrolling, visibility, loading UI, and canvas layout.
Plain-text paste at the caret remains available through keyboard editing. The composition does not intercept
Cmd/Ctrl+S. The galleries continue to use `editor-minimal` with entry outlines, arrows, context menus, project
saving/export, and block copy/paste.

`@8f4e/editor-plugin-loading-indicators` is installed eagerly before deferred loading and draws the unified
`state.loadingIndicators` list at the bottom left. Project loading, lazy plugin imports, and binary downloads contribute names while
loading. Each asset disappears when its downloaded bytes are available; compilation contributes its own indicator
while an attempt is active. This overlay does not block input.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-landing:build
npx nx run @8f4e/editor-landing:test
npx nx run @8f4e/editor-landing:typecheck
npx nx run @8f4e/8f4e-website:test:browser
```
