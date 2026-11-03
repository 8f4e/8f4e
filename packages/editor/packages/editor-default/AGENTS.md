# Default Editor Package Guidelines

- This package owns the standard editor composition: compiler integration, runtime plugin composition, example source discovery,
  standard-library resolution, and startup policy.
- Export composition APIs without mounting as an import side effect.
- Compose the standard plugin set here and expose host overrides through `plugins`; keep feature logic in its
  plugin package and generic plugin installation in editor-core.
- Call `createDefaultEditorPlugins` to construct the startup set synchronously per mounted editor, supplying the canvas, render
  callback, storage settings, Open menu visibility, and compiler getters. Keep file-session, URL/session loading, and
  code rendering eager. The deferred loader imports `src/deferred-plugins.ts` on core's `ready` event, after initial
  project loading/parsing, font-atlas loading, and rendering. This is the single gate for every optional and
  directive-based lazy import; do not add frame callbacks, visibility checks, or timing delays. Keep font payloads lazy.
- Keep all ordinary optional plugins as individual entries in `src/deferred-plugins.ts`, including input plugins.
  Load entries independently through the same loader; apply pointer capability and mode-switching availability as
  entry predicates. Keep project signals in `src/lazy-plugins.ts`. Do not create a separate keyboard loading group.
- Load `mouse-input` on every device, forwarding the host's `captureWheel` to its factory. Load
  `touch-viewport-navigation` only for `(pointer: coarse)`; keyboard navigation/editing/mode switching remain for fine pointers.
  Mouse forwarding stays active on coarse devices so touch taps reach existing controls. Core owns no DOM input adapter.
- Construct one `createProjectFileSession()` per default feature set and install its `plugin` before project loaders.
  Compose `createProjectOpenPlugin({ document: canvas.ownerDocument, fileSession, showOpenMenuItem })` for Open and
  `createProjectSavePlugin({ inputTarget: canvas, fileSession })` for Save/Export and Cmd/Ctrl+S. The session holds only
  the shared handle and reset lifecycle. Save owns serialization and all write coordination.
  Compose `createWasmExportPlugin({ document, getCodeBuffer })` for WASM files. Keep browser file handling out of core.
- Keep generic editor behavior in `@8f4e/editor-core` and website/deployment concerns in `@8f4e/editor-website`.
- Run `npx nx run @8f4e/editor-default:build|test|typecheck` after changing this package.
- The Vite build uses standard TypeScript and asset handling; project-authored GLSL effects are not supported.
- Stdlib and example module discovery use `@8f4e/vite-plugin-sources` in `vite.config.ts`. Resolve each source package
  root through its exported `package.json`; keep collection IDs relative to their configured source root. Stdlib
  resolution imports `virtual:8f4e-sources/stdlib`; plugin composition imports `virtual:8f4e-sources/example-modules`.
  Tests register the same Vite plugins.
- Discover example module sources relative to the examples package's `src/modules` directory. Pass the lazy loader
  map to `createExampleModulesPlugin({ sources })`. Metadata, source caching, dependencies, and the menu belong to
  that plugin; keep the default editor responsible only for discovery and composition.
- Keep `@8f4e/examples` as a dependency so its generators run before discovery and its sources affect build caching.

- Load watch and stack from the lazy registry for `@watch`/`@w` and `@stack`/`@s`. Supply their factories
  with a live reduced-motion preference from the browser. Their block drawers run before tooltip overlays,
  independently of installation order.
- Compose `createLazyPluginLoaderPlugin` with the per-editor `createLazyPluginRegistry` for optional signal-driven plugins.
  Keep its per-editor registry in `src/lazy-plugins.ts` for plot, wave, meter, bars, watch, stack, switch, button, piano, slider,
  crossfade, MIDI input, binary assets, and runtime plugins. Match all three wave directives: `wave`, `wave2`, and `wave4`, and raw
  `midi`/`bin`/`textureRuntime` config roots before their schemas load. Also match `@textureUpload` and `@texture`. Import implementations and construct
  their factories only inside `load()`, using the supplied live memory writer. Supply runtime plugins with compiler artifact getters and the optional shared AudioContext. Each runtime plugin imports its own worker/worklet assets and owns browser API use.
  Declare `scope: 'view'` for visual/control plugins and `scope: 'project'` for runtime, MIDI, and asset plugins.
  Match cached parsed directive records; the loader scans automatically after completed project edits and view changes.
  Mounting and initial project notifications do not wait for lazy plugin imports. The loader owns late installation
  and disposal; core keeps the ordinary plugin contract.
- Include `favoritesPlugin` and `removeMemoryConnectionsPlugin` after the execution-toggle plugin. Favorites stays
  unconditional in the deferred set so its editing action is available without a directive. The plugin owns favorite detection, both menus,
  navigation actions, and its env-source marker; core does not install favorite behavior.
- Construct `createGroupingPlugin({ writeClipboardText })` after the execution-toggle plugin. It owns editor `@group` membership, dragging, copying and group menus. It does not rename pasted groups.
- Load `createBinaryAssetsPlugin({ getMemoryBytes })` from the lazy registry with a getter for current compiler memory.
  Fetching, caching, binary metadata, loading UI, and generated asset constants remain inside the plugin.
- Include `assertionMarkersPlugin` and `createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory })` in the deferred
  standard set. Load `createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })` from the lazy registry. Supply
  the canvas's browser navigator and live compiler getters to that registry. MIDI owns WASM instantiation and caching;
  core has no separate environment-plugin system.
- Include `createProjectUrlLoaderPlugin({ fetch, initialProjectUrl })` and
  `createSessionPersistencePlugin({ storage, storageKey, restoreOnStartup })` in the default set. Disable only session
  restoration when an explicit initial URL exists. Keep autosaving active while that URL is pending.
- The plugins own URL fetching and storage serialization. Do not restore session/URL callbacks in core or host wrappers.
- Forward onInitialProjectLoaded/onInitialProjectLoadError to the URL plugin's factory callbacks. Without a URL,
  notify success after editor initialization. Mounting waits for fetching/parsing and the first render; callbacks may
  precede mount resolution.
- Test URL/session startup coordination in `src/startup.integration.test.ts` using the real default plugin composition.
  Keep each startup plugin's own tests independent of the other plugin.

- Construct `createCompilerPlugin({ resolveInclude })` before the feature plugins. Always prepend its `plugin`, including for custom feature arrays and `plugins: []`. Editor state forwards neither a compiler callback nor a resolver.
- The compiler plugin owns scheduling, worker lifetime, artifacts, diagnostics, and statistics. Return the core editor directly; do not wrap disposal to terminate a separate host compiler service.
- Supply the compiler plugin's live `writeMemory` to button, switch, slider, piano, crossfade, and keyboard-memory factories. Core has no memory-write callback.

- The compiler plugin publishes `ProgramArtifacts` (`memoryRef`) for core rendering, without taking an editor argument. The full compilation result stays inside the plugin. Core owns memory-view updates. Derive bytecode size from `codeBuffer.byteLength`; do not restore unused status flags.

- Cached memory-write views belong to the compiler plugin. Pass its writer directly rather than allocating views in the host.
- Expose the compiler plugin's stable diagnostic read handle as `getCompilerDiagnostics` on the returned core editor. Webpage hosts may pass it to their external WebMCP bridge; mounting the default editor does not register site tools.

- Audio, worker, test, and texture execution are ordinary lazy plugins in `packages/editor/plugins/audio-runtime`,
  `worker-runtime`, `test-runtime`, and `texture-runtime`. The default editor matches their raw `@config` roots before their schemas load.
  Each owns `enabled` (default false), schema registration, compiler readiness, execution, and cleanup. They may run
  together against shared compiler memory. Keep worker/worklet execution code in the existing runtime packages.
- Audio and worker runtime constant names are configured with `sampleRateConstantName` (default `SAMPLE_RATE`) and audio's
  `bufferSizeConstantName` (default `AUDIO_BUFFER_SIZE`). Each contributes under its own environment key. Keep info
  namespaces fixed: `info.audioRuntime`, `info.workerRuntime`, and `info.testRuntime`. Core has no runtime registry,
  selector, factory contract, or runtime values bag. Use `memoryValuesChanged` to refresh externally changed memory.

- Install `codeRenderingPlugin` eagerly for code/notes text and syntax highlighting. Keep text preparation and caching
  in the plugin and editing/layout geometry in core.
- Install `connectorsPlugin` in the deferred plugin set. It owns all input/output widgets and GPU wire rendering;
  core owns only generic render-layer lifecycle.
- Keep the `selectionAnimationPlugin` entry commented out. The standalone plugin owns the circling selected-block
  segment through the foreground drawer hook; core retains selection state and geometry.

- Per-frame WASM execution and texture upload/view directives belong entirely to `editor-plugin-texture-runtime`.
  `textureRuntime` config owns `enabled` and `entry`. `@textureUpload <address> <format> <width> <height>` defines a source;
  `@texture <address> <magnification> <width> <height> [<x> <y>]` defines a full or cropped view. Both use pointer sources,
  resolved to byte addresses after entry execution each frame. Discover uploads throughout the project and share one
  upload per visible address, with one GPU program for all formats. Views reserve fixed layout space from explicit dimensions, independent of compiler state and pointer changes.
  Both compositions match raw runtime config and either directive with project scope. Keep parsing outside the frame
  path and release storage without visible views. The overlay remains above editor content without block occlusion.

- Run `npx nx run @8f4e/editor-default:test:screenshot` for real-plugin browser composition coverage: lazy plot
  activation/navigation, project Open/Save, and compiler/texture-runtime rendering. Keep individual feature behavior
  in its owning plugin; this package owns combinations of real plugins.

- Keep keyboard navigation, editing, and mode switching independent. Dynamically import their factories only when
  `(pointer: coarse)` does not match after the first render. The mode-switching plugin owns keyboard hints, so omitting it
  also removes those overlays.
  The keyboard-editing plugin owns its mode-triggered implementation import and input buffering; keep feature
  behavior and pending-input lifecycle out of the host and generic directive lazy loader.
- Include `font-preview` in that desktop-only import set. F18/F19 preview fonts without editing source; keep its
  keyboard handling and preview lifecycle inside the plugin. Minimal does not include this authoring utility.

- `includeKeyboardModeSwitching: false` omits the mode-switching factory import and plugin. This is composition
  policy; core has no mode-switching feature flag and the plugin has no runtime enable guard.

- Load `code-block-copy-paste` as an unconditional deferred entry. Inject browser clipboard read/write functions into its factory and a writer into grouping independently. Text paste belongs to keyboard-editing; keep clipboard routing out of the host and shared context.
