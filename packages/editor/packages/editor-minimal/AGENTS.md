# Minimal Editor Package Guidelines

- Own the embedded composition for the product homepage and example/test galleries. Build directly on editor-core;
  do not import editor-default or its built-in module catalog.
- Keep file-session, project URL loading, compiler coordination, block backgrounds, and code rendering eager. Import
  `src/deferred-plugins.ts` on core's `ready` event, after initial project loading/parsing, font-atlas loading, and
  rendering. This is the single gate for input, connectors, assertions, saving, tooltips, and directive-based lazy
  imports. Do not add frame
  callbacks, visibility checks, or timing delays. Keep font payloads lazy.
- Keep all ordinary optional plugins as individual entries in `src/deferred-plugins.ts`, including input plugins.
- Load `errorMessagesPlugin` as an unconditional deferred entry. Raw contributor-owned error lists stay central;
  the plugin owns wrapping, layout reservations, coordinates, and drawing.
  Load entries independently through the same loader; apply pointer capability and mode-switching availability as
  entry predicates. Keep project signals in `src/lazy-plugins.ts`. Do not create a separate keyboard loading group.
- Load `mouse-input` on every device and forward `captureWheel` to its factory. Match `touch-input`
  only for `(pointer: coarse)`. Mouse forwarding handles touch taps while the touch plugin owns viewport dragging.
- Keep live editing and runtime controls available. Let the project's `@mode` directive select its initial mode
  (view by default), and disable project creation by default.
  Hosts own wheel capture, mode-toggle preferences, page URLs, loading UI, visibility, and WebMCP registration.
- Construct the compiler first and inject its live handles into dependent plugin factories. Return the core editor
  with its compiler diagnostic getter; plugin disposal owns compiler, input, and runtime cleanup.
- Keep standard-library discovery in this package's Vite configuration and lazy include resolver. There is no
  example-module source collection here.
- Keep project signals and dynamic imports in `src/lazy-plugins.ts`. Plugins own feature logic; the existing loader
  owns activation and disposal. Match `@watch`/`@w`, `@stack`/`@s`, all wave variants, and raw `midi`, `bin`, `textureRuntime`, and runtime config roots before their
  schemas load. Declare `scope: 'view'` for visual/control plugins and `scope: 'project'` for runtime, MIDI, and
  asset plugins. Match cached directives; completed project changes and group navigation trigger automatic scans.
  Supply the browser navigator and live compiler getters to the registry for MIDI and binary assets.
- Supply the canvas and browser navigator to input plugins, memory getters to binary assets, and the compiler memory
  writer to interactive controls. Pass a live reduced-motion preference to lazy watch/stack factories. All block
  drawers run in registration order, including later lazy installations.
- The project URL plugin owns fetching. Forward initial-project callbacks; mounting waits for fetching/parsing and the
  first render.
  Without a URL, start empty and announce readiness after initialization.
- Construct one `createProjectFileSession()` and install its plugin before the
  project URL loader. Pass it to `createProjectSavePlugin({ inputTarget: canvas, fileSession })` for Save, Export Project, and Cmd/Ctrl+S.
- Keep Open From Disk, session storage, WASM export/screenshot plugins, built-in module browsing, grouping, and optional editing
  actions, including favorite navigation and editing, in editor-default. Add no storage options, callbacks, or
  compatibility wrappers here.
- Verify with `npx nx run @8f4e/editor-minimal:build|test|typecheck`. The product website's `test:browser` target covers
  real compiler execution, URL loading, lazy controls/runtimes, editing, bridge lifecycle, and disposal.

- Install `codeRenderingPlugin` eagerly for code/notes text, syntax highlighting, and nested block backgrounds. Keep
  text/highlight preparation and caching in the plugin and editing/layout geometry in core.
- Load `dialogsPlugin` as an unconditional deferred entry. It owns private dialog layout, hit testing, and drawing;
  editor-state retains dialog content, lifecycle, button actions, and modal input blocking.
- Install `connectorsPlugin` in the deferred plugin set. It owns all input/output widgets and GPU wire rendering;
  core owns only generic render-layer lifecycle.
- Keep the `selectionAnimationPlugin` entry commented out. The standalone plugin owns the circling selected-block
  segment through the ordered block drawer hook; core retains selection state and geometry.

- Per-frame WASM execution and texture upload/view directives belong entirely to `editor-plugin-texture-runtime`.
  `textureRuntime` config owns `enabled` and `entry`. `@textureUpload <address> <format> <width> <height>` defines a source;
  `@texture <address> <magnification> <width> <height> [<x> <y>]` defines a full or cropped view. Both use pointer sources,
  resolved to byte addresses after entry execution each frame. Discover uploads throughout the project and share one
  upload per visible address, with one GPU program for all formats. Views reserve fixed layout space from explicit dimensions, independent of compiler state and pointer changes.
  Both compositions match raw runtime config and either directive with project scope. Keep parsing outside the frame
  path and release storage without visible views. The overlay remains above editor content without block occlusion.

- Keep keyboard navigation, editing, and mode switching independent. Dynamically import their factories after the first render, only when
  `(pointer: coarse)` does not match. The mode-switching plugin owns keyboard hints, so omitting it
  also removes those overlays.
  The keyboard-editing plugin owns its mode-triggered implementation import and input buffering; keep feature
  behavior and pending-input lifecycle out of the host and generic directive lazy loader.

- `includeKeyboardModeSwitching: false` omits the mode-switching factory import and plugin. This is composition
  policy; core has no mode-switching feature flag and the plugin has no runtime enable guard.

- Forward `touchNavigation` (`axis`) to the touch input plugin without implementing gestures in
  the composition. Panning uses one finger on both axes by default; the product landing page and galleries select horizontal panning.

- Load `code-block-copy-paste` as an unconditional deferred entry with injected browser clipboard read/write functions. Text paste is owned separately by keyboard-editing. Keep clipboard browser access out of core and the shared plugin context.

- Install `codeBlockBackgroundPlugin` eagerly before `codeRenderingPlugin`. Every block drawer uses the same
  ordered registration API, including deferred plugins. Do not restore separate drawing stages or aliases.

- Load `contextMenuPlugin` as an unconditional deferred entry. It owns menu formatting, geometry, hover/hit testing,
  and drawing through `registerCanvasDrawer`; core keeps raw menu items, contributions, navigation, and action dispatch.

- Load `offscreenBlockArrowsPlugin` as an unconditional deferred entry. It owns viewport-edge arrow geometry and
  drawing through the single replaceable `registerOffscreenCodeBlockDrawer` callback. Core retains the block traversal.

- Load `entryOutlinesPlugin` as an unconditional deferred entry. It draws borders and labels from core's entry bounds
  below blocks through `registerCanvasBackgroundDrawer`. Entry bounds and insertion assignment remain in editor-state.
