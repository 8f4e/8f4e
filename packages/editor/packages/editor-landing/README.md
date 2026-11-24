# Landing Editor

`@8f4e/editor-landing` composes the editor for interactive landing-page demos. It provides live editing, compilation,
URL loading, the worker runtime, watch/stack annotations, plot, scope, and slider controls. Stack Connections draws links beside
the selected code block from each operand producer to the highlighted instruction. Each mount starts fresh without browser
session persistence. Standard-library discovery and include resolution are omitted; homepage demos must be self-contained,
including after live edits.

The composition omits assertion markers, keyboard mode switching, dialogs, test/audio/texture runtimes, binary assets,
MIDI input, keyboard-to-memory input, bars, meter, wave, crossfade, switch, button, and piano. It also omits entry
outlines, offscreen block arrows, context menus, project creation, block authoring, project saving/export, file-session tracking, block copy/paste, and loading
indicators. Context-menu requests are disabled so an invisible menu cannot block input.

```ts
import { mountLandingEditor } from '@8f4e/editor-landing';

const editor = await mountLandingEditor(canvas, {
	initialProjectUrl: '/examples/demo.8f4e',
	captureWheel: false,
	touchNavigation: { axis: 'horizontal' },
});

editor.dispose();
```

Pass `defaultFont` (for example, `defaultFont: 'pixelcode6x12'`) to choose the font used by projects without
a `; @config font` directive. Otherwise, the composition chooses PixelCode 6×12 when `(pointer: coarse)` matches
at mount time and IBM VGA 8×16 on other devices. A project font directive takes priority; removing it or loading
a project without one restores the mount's default. This preference is kept outside project source and saved files.

`LandingEditorMountOptions` accepts `initialProjectUrl`,
`captureWheel`, `touchNavigation`, `defaultFont`, and `featureFlags`. Context menus are always
disabled. The source's `@mode` directive selects the initial mode (view by default). Keyboard navigation and editing
remain available on non-coarse pointers; no keyboard mode toggle or hint is installed. A failed initial URL rejects the mount
promise. Mount completion, initial-project errors,
rendering controls, compiler diagnostics, and disposal follow the
[gallery editor's lifecycle](../editor-gallery/README.md).

The compiler, URL loader, home navigation, the dotted canvas background, block backgrounds, and code rendering load eagerly.
`@8f4e/editor-plugin-home` supplies initial viewport placement through `; @home` even without a context menu.
`@8f4e/editor-plugin-dotted-background` draws the world-anchored dot pattern before sprites using the presented
viewport's origin and cell dimensions, plus the active palette.
Core's `ready` event
gates all optional imports through `src/deferred-plugins.ts`. `src/lazy-plugins.ts` matches visual/control plugins
in the current view and the worker runtime throughout the project. Font payloads remain lazy.
Keyboard input follows pointer capabilities; the host owns scrolling, visibility, loading UI, and canvas layout.
The landing editor uses [`@8f4e/editor-plugin-viewport-mouse-input`](../../plugins/viewport-mouse-input/README.md) for
mouse input. On devices with a fine primary pointer, it keeps a primary-button mouse drag on its starting demo
even when the pointer leaves the canvas. Touch gestures and wheel scrolling are unchanged.
Plain-text paste at the caret remains available through keyboard editing. The composition does not intercept
Cmd/Ctrl+S. The galleries continue to use `editor-gallery` with entry outlines, arrows, context menus, project
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
