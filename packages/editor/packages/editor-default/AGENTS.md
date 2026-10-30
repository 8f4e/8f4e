# Default Editor Package Guidelines

- This package owns the standard editor composition: compiler integration, runtime plugin composition, example source discovery,
  standard-library resolution, and startup policy.
- Export composition APIs without mounting as an import side effect.
- Compose the standard plugin set here and expose host overrides through `plugins`; keep feature logic in its
  plugin package and generic plugin installation in editor-core.
- Construct the standard set with `createDefaultEditorPlugins` per mounted editor, supplying the canvas, render
  callback, storage settings, Open menu visibility, and compiler getters. Render callbacks run after initialization.
- Compose `createProjectFilesPlugin({ inputTarget: canvas, showOpenMenuItem })` for Open, Save, and Export. It owns
  file handles and all browser file operations. Compose `createWasmExportPlugin({ document, getCodeBuffer })` for WASM
  files. Do not add a host file service or file callbacks in core.
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

- Compose watch and stack with the fixed default plugin set. Supply their factories
  with a live reduced-motion preference from the browser; install their overlays before tooltips.
- Compose `createLazyPluginLoaderPlugin` with the per-editor `createLazyPluginRegistry` for optional signal-driven plugins.
  Keep its per-editor registry in `src/lazy-plugins.ts` for plot, wave, meter, bars, switch, button, piano, slider,
  crossfade, MIDI input, binary assets, and runtime plugins. Match all three wave directives: `wave`, `wave2`, and `wave4`, and raw
  `midi`/`bin`/`textureRuntime` config roots before their schemas load. Also match `@texture`. Import implementations and construct
  their factories only inside `load()`, using the supplied live memory writer. Supply runtime plugins with compiler artifact getters and the optional shared AudioContext. Each runtime plugin imports its own worker/worklet assets and owns browser API use.
  Declare `scope: 'view'` for visual/control plugins and `scope: 'project'` for runtime, MIDI, and asset plugins.
  Match cached parsed directive records; the loader scans automatically after completed project edits and view changes.
  Mounting and initial project notifications do not wait for lazy plugin imports. The loader owns late installation
  and disposal; core keeps the ordinary plugin contract.
- Include `favoritesPlugin` and `removeMemoryConnectionsPlugin` after the execution-toggle plugin. Favorites stays
  fixed so its editing action is available before the first directive. The plugin owns favorite detection, both menus,
  navigation actions, and its env-source marker; core does not install favorite behavior.
- Include `groupingPlugin` after the execution-toggle plugin. It owns editor `@group` behavior, including drag and
  paste policies and group menus; it has no browser factory dependencies.
- Load `createBinaryAssetsPlugin({ getMemoryBytes })` from the lazy registry with a getter for current compiler memory.
  Fetching, caching, binary metadata, loading UI, and generated asset constants remain inside the plugin.
- Include `assertionMarkersPlugin` and `createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory })` in the fixed
  standard set. Load `createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })` from the lazy registry. Supply
  the canvas's browser navigator and live compiler getters to that registry. MIDI owns WASM instantiation and caching;
  core has no separate environment-plugin system.
- Include `createProjectUrlLoaderPlugin({ fetch, initialProjectUrl })` and
  `createSessionPersistencePlugin({ storage, storageKey, restoreOnStartup })` in the default set. Disable only session
  restoration when an explicit initial URL exists. Keep autosaving active while that URL is pending.
- The plugins own URL fetching and storage serialization. Do not restore session/URL callbacks in core or host wrappers.
- Forward onInitialProjectLoaded/onInitialProjectLoadError to the URL plugin's factory callbacks. Without a URL,
  notify success after editor initialization. Mounting must not wait for fetching; callbacks may precede mount resolution.
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

- Install `connectorsPlugin` in the fixed plugin set. It owns all input/output widgets and GPU wire rendering;
  core owns only generic render-layer lifecycle.

- Per-frame WASM execution and `@texture` framebuffer views belong entirely to `editor-plugin-texture-runtime`.
  Its `textureRuntime` config owns only `enabled` and `entry`; each directive owns its framebuffer, format, dimensions,
  and integer magnification. Both compositions load it lazily from `@texture` or raw `textureRuntime` config with
  project scope and compiler getters. Layout contributions reserve rows and a minimum block width; private views
  resolve memory in the containing block's scope. One GPU program and rectangle serve all 1bit/mono/rgb/rgba views.
  The generic overlay pass executes the entry once per editor frame and draws visible textures at block-relative
  positions above the editor, without block occlusion. Rendering remains active when entry execution is disabled.
  Keep parsing and memory lookup outside the frame path; release storage for removed/offscreen views and on GPU release.
