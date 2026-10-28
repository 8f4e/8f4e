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

- Compose meter, plot, bars, crossfade, watch, and stack with the default plugin set. Supply watch/stack factories
  with a live reduced-motion preference from the browser; install their overlays before tooltips.
- Include `toggleFavoritePlugin` and `removeMemoryConnectionsPlugin` after the execution-toggle plugin. Core does
  not install these editing actions or their menus.
- Compose `createBinaryAssetsPlugin({ getMemoryBytes })` with a getter for the compiler service's current memory.
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

- Configure `resolveInclude` when creating the compiler service. Editor state does not forward a resolver.
- Supply the compiler service's live `writeMemory` to button, switch, slider, piano, crossfade, and keyboard-memory factories. Core has no memory-write callback.
- Supply lazy runtime loaders as registry dependencies. Loading, caching, and disposal belong to the runtime coordinator; state holds IDs/schemas and derived constant source only.

- Return the narrow editor compilation result, including `memoryRef`, without taking an editor argument. Core owns memory-view updates. Derive bytecode size from `codeBuffer.byteLength`; do not restore unused status flags.

- Cache memory-write typed-array views per compiler service and refresh only when the backing buffer changes, including shared/unshared memory growth. Repeated control writes must not allocate new views.
