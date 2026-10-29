# Default Editor Package Guidelines

- This package owns the standard editor composition: compiler integration, runtime selection, example source discovery,
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
- Compose `createLazyPluginLoaderPlugin(createLazyPlugins({ writeMemory }))` for optional signal-driven plugins.
  Keep its per-editor registry in `src/lazy-plugins.ts` for plot, wave, meter, bars, switch, button, piano, slider,
  and crossfade. Match all three wave directives: `wave`, `wave2`, and `wave4`. Import implementations and construct
  their factories only inside `load()`, using the supplied live memory writer.
  Mounting and initial project notifications do not wait for lazy plugin imports. The loader owns project-load scans,
  its manual scan menu, late installation, and disposal; core keeps the ordinary plugin contract.
- Include `toggleFavoritePlugin` and `removeMemoryConnectionsPlugin` after the execution-toggle plugin. Core does
  not install these editing actions or their menus.
- Include `groupingPlugin` after the execution-toggle plugin. It owns editor `@group` behavior, including drag and
  paste policies and group menus; it has no browser factory dependencies.
- Compose `createBinaryAssetsPlugin({ getMemoryBytes })` with a getter for the compiler plugin's current memory.
  Fetching, caching, binary metadata, loading UI, and generated asset constants remain inside the plugin.
- Include `assertionMarkersPlugin`, `createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory })`, and
  `createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })` in the standard set. Use the canvas's browser
  navigator and live compiler getters. MIDI owns WASM instantiation and caching; core has no separate environment-plugin system.
- Include `createProjectUrlLoaderPlugin({ fetch, initialProjectUrl })` and
  `createSessionPersistencePlugin({ storage, storageKey, restoreOnStartup })` in the default set. Disable only session
  restoration when an explicit initial URL exists. Keep autosaving active while that URL is pending.
- The plugins own URL fetching and storage serialization. Do not restore session/URL callbacks in core or host wrappers.
- Forward onInitialProjectLoaded/onInitialProjectLoadError to the URL plugin's factory callbacks. Without a URL,
  notify success after editor initialization. Mounting must not wait for fetching; callbacks may precede mount resolution.
- Test URL/session startup coordination in `src/startup.integration.test.ts` using the real default plugin composition.
  Keep each startup plugin's own tests independent of the other plugin.

- Construct `createCompilerPlugin({ resolveInclude })` before the feature plugins and runtime registry. Always prepend its `plugin`, including for custom feature arrays and `plugins: []`. Editor state forwards neither a compiler callback nor a resolver.
- The compiler plugin owns scheduling, worker lifetime, artifacts, diagnostics, and statistics. Return the core editor directly; do not wrap disposal to terminate a separate host compiler service.
- Supply the compiler plugin's live `writeMemory` to button, switch, slider, piano, crossfade, and keyboard-memory factories. Core has no memory-write callback.
- Supply lazy runtime loaders as registry dependencies. Loading, caching, and disposal belong to the runtime coordinator; state holds IDs/schemas and derived constant source only.

- The compiler plugin publishes `ProgramArtifacts` (`memoryRef` and `codeBuffer`) for core rendering, without taking an editor argument. The full compilation result stays inside the plugin. Core owns memory-view updates. Derive bytecode size from `codeBuffer.byteLength`; do not restore unused status flags.

- Cached memory-write views belong to the compiler plugin. Pass its writer directly rather than allocating views in the host.
- Expose the compiler plugin's stable diagnostic read handle as `getCompilerDiagnostics` on the returned core editor. Webpage hosts may pass it to their external WebMCP bridge; mounting the default editor does not register site tools.
