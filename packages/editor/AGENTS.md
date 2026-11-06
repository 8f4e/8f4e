# Repository Guidelines

## Package Scope & Layout

- Path: `packages/editor`; this is an organizational parent for editor-owned packages.
- Editor libraries and hosts live in `packages/`. Optional feature plugins live in `plugins/<feature>/`, each with
  its own package named `@8f4e/editor-plugin-<feature>`. Keep plugin directories short and package names explicit.
- Plugin docs describe factory dependencies, loading signals, and lifecycle contracts. Composition docs own plugin
  selection; do not list consuming editors or their count in plugin docs.
- `@8f4e/editor-core` is the minimal reusable editor.
- Editor-core owns the single frame loop and advances viewport state before web-ui draws. Web-ui has no frame
  scheduler or navigation-state updates; it owns drawing and GPU resources.
- `@8f4e/editor-plugin-compiler` owns compilation scheduling, worker communication, current artifacts, diagnostics, and statistics. The default composition constructs and installs it first, passing stable handles to dependent feature and runtime plugins. Core announces compilation input changes and consumes accepted rendering artifacts; it has no compile callback.
- Loading operations contribute `{ id, message }` through `loading.add` in the plugin setup context.
  The returned handle exposes `done()`, `fail()`, and `cancel()`; the first terminal result records `finishedAt`.
  State retains `status`, `startedAt`, and `finishedAt` in the unified `state.loadingIndicators` list. Reusing an ID
  replaces its entry; old handles cannot update the replacement. The eager `editor-plugin-loading-indicators` owns
  prepared elapsed-time/status drawing and private visibility bookkeeping; it never deletes state contributions.
  Done results hide after 1/2/3 seconds for operations lasting up to 100 ms, over 100 ms through 500 ms, or over
  500 ms respectively; failed/cancelled hide after five seconds. Expired items hide oldest finish first at 25 ms
  intervals. Hiding sleeps until needed and runs independently of drawing; same-ID replacements become visible again.
- `@8f4e/editor-plugin-code-rendering` owns code/notes text, syntax highlighting, nested block backgrounds,
  line-number drawing, and private prepared sprite cells and highlight rectangles. Editor compositions install it eagerly.
  Core retains editing/layout geometry. Web-ui invokes one `registerCodeBlockDrawer` registry in registration order
  within its existing visible-block loop. The eager `code-block-background` plugin is installed before code rendering.
  Code rendering owns selected-line fill; code-block-background owns corner markers. The deferred
  `offscreen-block-arrows` plugin owns arrow placement and drawing through a single replaceable
  `registerOffscreenCodeBlockDrawer` callback in the same traversal. `canvasOverlays` also controls offscreen decorations.
- `@8f4e/editor-palette` owns pure palette validation and predefined shades; drawers use its shared tokens.
- Editor-state owns `codeBlockRendering.entryBounds`, including padding, updates, and insertion hit testing.
  `@8f4e/editor-plugin-entry-outlines` only draws borders and labels through `registerCanvasBackgroundDrawer` below blocks.
  The default and minimal compositions defer drawing until `ready`; entry assignment works independently of the plugin.
- `editor-plugin-block-authoring` owns New Module/Function/Prototype/Note templates, random names, Delete, and
  their menu contributions. Default and minimal load it after `ready`; landing omits it. Generic insertion/deletion,
  entry assignment, layout, revisions, and history stay in editor-state. Folding and shared source/display mappings
  remain in editor-state.
- `@8f4e/editor-plugin-context-menu` owns menu labels, sizing, grid snapping, viewport clamping, hover state, hit testing,
  and drawing. Core keeps raw items, requested world anchors, menu navigation, input blocking, and action/selector dispatch.
  The default and minimal compositions defer it until `ready`. Web-ui exposes `registerContextMenuOverlay` above editor overlays and below modal dialogs.
- `@8f4e/editor-plugin-dialogs` owns dialog dimensions, wrapping/clipping, private button geometry/hit testing,
  and drawing. Editor-state owns dialog content/stack, opening/closing, button actions, and modal input blocking.
  Editor compositions load dialogs through their unconditional deferred registries after `ready`. Web-ui supplies
  `registerModalOverlay` after context-menu overlays, independently of `canvasOverlays`.
- `@8f4e/editor-plugin-selection-animation` owns the selected block's circling segment and uses the generic ordered block
  drawing hook. Its deferred entries are commented out in default/minimal and omitted from landing; core retains selection state and geometry.
- Web-ui contributes font/color configuration through `registerWebUiConfig(store)` and owns defaults, loading, and
  subscriptions. Editor-core calls it before plugins/project loading; renderer initialization receives the store and
  event dispatcher. Editor-state uses only grid dimensions and the generic `gridSizeChanged` event.
- Keep `@8f4e/editor-palette` external in bundled editor libraries so the final composition can share one palette module.
- Editor compositions start every optional import, including directive-based plugins, on core's `ready` event after
  initial project loading/parsing, font-atlas loading, and rendering. Keep font payloads lazy; add no frame callbacks or
  timing gates.
- External lists match exact import paths; include used dependency subpaths such as `glugglugglug/utils` explicitly.
- `@8f4e/editor-default` composes the core with compiler, worker, runtimes, standard library, example source discovery,
  and startup policy.
- `@8f4e/editor-minimal` independently composes the embedded editor for the galleries. Keep live
  editing, controls, visualizations, compiler/runtime plugins, input, URL loading, and project source saving/export. Keep session
  storage, built-in modules, Open From Disk, WASM export, screenshots, and optional authoring actions in editor-default.
- `@8f4e/editor-landing` independently composes the product homepage editor with the same embedded capabilities,
  omitting entry outlines, offscreen block arrows, context menus, project saving/export, file-session tracking,
  block copy/paste, and loading-indicator presentation. Keep plain-text paste in keyboard editing and core's `contextMenu` feature disabled.
- `@8f4e/editor-website` is the thin deployable Vite host for the default composition.
- `@8f4e/editor-webmcp` is an external, page-owned adapter bound to one editor's public editing handle. Hosts own its registration and dispose it before replacing the editor; it is not an editor plugin.
- The bridge bundles its help, compiler/editor documentation, and example catalogs using `@8f4e/vite-plugin-sources` at build time. Its `generate-content` target prepares the search index and lazy content modules before build/test/typecheck; hosts need no content configuration.
- `@8f4e/editor-plugin-toggle-skip-execution` owns the optional single-module execution toggle. The switch widget
  lives in `@8f4e/editor-plugin-switch`, momentary buttons in `@8f4e/editor-plugin-button`, waveforms in
  `@8f4e/editor-plugin-wave`, piano keyboards in `@8f4e/editor-plugin-piano`, sliders in `@8f4e/editor-plugin-slider`,
  selected-line tooltips in `@8f4e/editor-plugin-tooltips`, browser screenshots in `@8f4e/editor-plugin-screenshot`,
  project opening in `@8f4e/editor-plugin-project-open`, project saving/export in
  `@8f4e/editor-plugin-project-save`, and WebAssembly export in `@8f4e/editor-plugin-wasm-export`.
  Editors with file plugins compose one `@8f4e/editor-file-session` and install its plugin before file plugins and project loaders.
  Inject it into Open and Save to share the handle and project replacement cleanup. The Save plugin owns serialization
  and all write coordination.
  Meter, plot, bars, crossfade, watch, and stack each live in their matching `editor-plugin-<name>` packages.
  Favorite detection, editing, and navigation live in `editor-plugin-favorites`, and memory-default disconnection in
  `editor-plugin-remove-memory-connections`. Core has no favorite-specific block state or menus.
  Visual `@group` behavior lives in `editor-plugin-grouping`, including private membership, dragging, and group copying,
  and group action menus. Nested language-level project groups remain in core.
  `editor-plugin-binary-assets` owns binary fetching, caching, memory loading, loading indicators, and size constants.
  Assertion marker drawing lives in `editor-plugin-assertion-markers`, keyboard-to-memory input in
  `editor-plugin-keyboard-memory`, and MIDI discovery/input in `editor-plugin-midi-input`. These use the same plugin
  contract; there is no separate environment-plugin manager. Assertion results and raw error contributions remain
  central. `editor-plugin-error-messages` owns inline message presentation and loads through composition deferred registries.
  `editor-plugin-jump-to-error` owns the fixed error-navigation button; default/minimal defer it, and landing omits it.
  Plugin contracts and installation live in `editor-core`,
  generic directive processing in `editor-state`, and drawer hooks in `web-ui`.
  `editor-plugin-lazy-loader` scans cached directives automatically after project changes and group navigation.
  Explicit registry scopes match visual/control plugins in the current project level and runtime/keyboard-memory/MIDI/asset plugins
  across the project tree. Matching plugins stay installed until editor disposal. Editor compositions' lightweight registries dynamically import plot, wave,
  meter, bars, watch, stack, switch, button, piano, slider, and crossfade for their directives, plus MIDI, binary assets, and runtime
  plugins for their raw config roots. Keyboard-memory also loads from raw `keyboard` configuration with project scope,
  receiving the canvas and live compiler memory writer only when needed.
  `editor-plugin-connectors` owns input/output geometry, private connector state, wire lookup, and all line GPU
  resources, plus shape/paramShape labels and row reservations. Editor compositions install it in their deferred plugin
  set after the first render. Web-ui provides generic render-layer lifecycle. Core has no `widgets` state.
  Core provides independent layout contributions and subscriptions; directive parsing and layout remain separate.
  Session restoration/autosaving and project URL loading live in `editor-plugin-session-persistence` and
  `editor-plugin-project-url-loader`. The default host supplies storage/fetch and chooses initial URL priority.
  The standard plugin set is composed in `editor-default`.
  `editor-plugin-example-modules` owns built-in block menus, catalog metadata, lazy source caching, public-block
  selection, and dependency insertion. The default editor supplies source loaders; core owns generic submenu registration.

- UI event subscriptions use numeric layers matching drawer stages. Higher layers run first; capture/normal handlers
  inside each layer run in reverse registration order. Unlayered notifications and default effects retain their ordering.
  Plugins receive configurable layers at factory construction where needed. Drawing remains in registration order;
  code-block targeting already follows the reverse of block stacking. `INPUT_LAYERS` lives in editor-state-types.

## Build, Test, Dev

- Clear each package's `dist/` before build output is emitted. Keep plain TypeScript plugin builds as
  `rm -rf dist && tsc`; mixed pipelines clean once before their first emitting step.
- Build or test the composition with `npx nx run @8f4e/editor-default:build|test|typecheck`.
- Build or verify the embedded composition with `npx nx run @8f4e/editor-minimal:build|test|typecheck` and
  `npx nx run @8f4e/8f4e-website:test:browser`.
- Build or verify the landing composition with `npx nx run @8f4e/editor-landing:build|test|typecheck` and
  `npx nx run @8f4e/8f4e-website:test:browser`.
- Build or verify the plugins with `npx nx run @8f4e/editor-plugin-toggle-skip-execution:build|test|typecheck` or
  `npx nx run @8f4e/editor-plugin-switch:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-tooltips:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-button:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-wave:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-piano:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-slider:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-screenshot:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-project-open:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck`.
  Build/typecheck `@8f4e/editor-file-session` and build/test/typecheck `@8f4e/editor-plugin-project-save` through Nx.
  Composed file behavior is covered by editor-default tests and the minimal-editor gallery browser tests.
- Verify example module browsing with `npx nx run @8f4e/editor-plugin-example-modules:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-example-modules:test:browser`.
- Verify startup plugins with
  `npx nx run-many --targets=build,test,typecheck --projects=@8f4e/editor-plugin-session-persistence,@8f4e/editor-plugin-project-url-loader`.
  Both have `test:screenshot` targets for their real editor startup paths.
- Start the website with `npx nx run @8f4e/editor-website:dev`.
- Verify the WebMCP adapter with `npx nx run @8f4e/editor-webmcp:build|test|typecheck` and its real-editor browser suite with `npx nx run @8f4e/editor-webmcp:test:browser`. Verify gallery loading and bridge switching with `npx nx run @8f4e/8f4e-website:test:browser`.
- Verify binary assets with `npx nx run @8f4e/editor-plugin-binary-assets:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-binary-assets:test:screenshot`.
- Verify assertion markers and input plugins with
  `npx nx run-many --targets=build,test,typecheck --projects=@8f4e/editor-plugin-assertion-markers,@8f4e/editor-plugin-keyboard-memory,@8f4e/editor-plugin-midi-input`.
  Assertion markers also have a `test:screenshot` target; MIDI tests require no hardware.
- Verify the favorite and memory-connection actions with
  `npx nx run-many --targets=build,test,typecheck --projects=@8f4e/editor-plugin-favorites,@8f4e/editor-plugin-remove-memory-connections`.
  Each also has a `test:browser` target for real-editor contribution/action integration, without sibling menu presentation.
- Verify connectors and their line renderer with `npx nx run @8f4e/editor-plugin-connectors:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`.
- Verify visual grouping with `npx nx run @8f4e/editor-plugin-grouping:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-grouping:test:browser`.
- Verify lazy plugin loading with `npx nx run @8f4e/editor-plugin-lazy-loader:build|test|typecheck`. Browser composition coverage runs through `npx nx run @8f4e/editor-default:test:screenshot`.
- Build or preview it with `npx nx run @8f4e/editor-website:build|serve`.
- Ensure dependency packages are built before relying on workspace aliases in the website.

- Verify error navigation with `npx nx run @8f4e/editor-plugin-jump-to-error:build|test|typecheck|test:screenshot`.
  The feature owns isolated browser tests; compositions cover source-line navigation through real mouse/touch adapters.

## Coding Style

- TypeScript (ES modules). Use Biome as the fixer (`npx biome check --write <files>`).
- Keep composition behavior in `editor-default`, `editor-minimal`, and `editor-landing`; keep hosting and deployment concerns in their websites.
- Prefer workspace aliases for inter-package references.

## Testing

- Vitest tests live under `src/__tests__` or alongside source as `*.test.ts`.
- Test composition behavior in `@8f4e/editor-default`, `@8f4e/editor-minimal`, and `@8f4e/editor-landing`; test reusable editor behavior in `@8f4e/editor-core`.
- `npx nx run @8f4e/editor-core:test:screenshot` covers viewport animation and culling through the real core/renderer.
- Feature-plugin tests cover their own behavior against core services. Do not install unrelated plugins to render
  fixture content or preserve screenshots; combined plugin rendering belongs in composition tests.

## Pull Requests

- Include test notes and explain any package-boundary changes.
- Add screenshots or GIFs when editor behavior or appearance changes.

- Audio, worker, test, and texture execution are ordinary lazy plugins in `packages/editor/plugins/audio-runtime`,
  `worker-runtime`, `test-runtime`, and `texture-runtime`. The default editor matches their raw `@config` roots before their schemas load.
  Each owns `enabled` (default false), schema registration, compiler readiness, execution, and cleanup. They may run
  together against shared compiler memory. Keep worker/worklet execution code in the existing runtime packages.
- Audio and worker runtime constant names are configured with `sampleRateConstantName` (default `SAMPLE_RATE`) and audio's
  `bufferSizeConstantName` (default `AUDIO_BUFFER_SIZE`). Each contributes under its own environment key. Keep info
  namespaces fixed: `info.audioRuntime`, `info.workerRuntime`, and `info.testRuntime`. Core has no runtime registry,
  selector, factory contract, or runtime values bag. Use `memoryValuesChanged` to refresh externally changed memory.

- Per-frame WASM execution and texture upload/view directives belong entirely to `editor-plugin-texture-runtime`.
  `textureRuntime` config owns `enabled` and `entry`. `@textureUpload <address> <format> <width> <height>` defines a source;
  `@texture <address> <magnification> <width> <height> [<x> <y>]` defines a full or cropped view. Both use pointer sources,
  resolved to byte addresses after entry execution each frame. Discover uploads throughout the project and share one
  upload per visible address, with one GPU program for all formats. Views reserve fixed layout space from explicit dimensions, independent of compiler state and pointer changes.
  Editor compositions match raw runtime config and either directive with project scope. Keep parsing outside the frame
  path and release storage without visible views. The overlay remains above editor content without block occlusion.

- Keyboard navigation, text editing/history shortcuts, and mode switching are independent input plugins. Editor compositions
  import their factories after the first render, only for non-coarse primary pointers. Editing loads its implementation on edit mode and
  owns pending input replay; test real plugin combinations in editor-default, never in sibling-plugin tests.
- Mouse/wheel DOM adaptation belongs to `mouse-input`, loaded on every device. Editor compositions match
  `touch-input` only for `(pointer: coarse)` in their deferred registries. Touch owns one-finger
  viewport gestures with configurable axes and restores canvas touch behavior on disposal. Core keeps event dispatch and input state effects.
  Feature-plugin tests dispatch core input events directly; native browser input belongs to input-plugin and composition tests.
- The default editor additionally imports `font-preview` with the desktop keyboard set. F18/F19 cycle temporary fonts;
  source, history, and exports stay unchanged. Minimal and landing omit it.

- Browser touch and mouse adaptation belongs to the input plugins. Core routes normalized pointer events before default selection and dragging. Controls consume device-independent
  `codeBlockPointerDown`/`codeBlockPointerMove`/`codeBlockPointerUp` events and claim pointer downs with
  `stopPropagation`. Keep DOM listeners and platform checks out of control plugins.

- Block copy/paste belongs to `editor-plugin-code-block-copy-paste`, composed by default and minimal with injected clipboard read/write functions. Grouping receives its own writer. Core has no clipboard callbacks or copy/paste actions; it exports pure `serializeCodeBlocks` and generic `insertCodeBlocks`. Pasting changes only `@pos` for placement: preserve declaration names, group names, references, and entry metadata without numbering or transform hooks.
- Keyboard-editing handles native plain-text paste at the caret through its loaded implementation. Do not buffer paste events or add loading-race handling.
