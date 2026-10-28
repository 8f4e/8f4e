# Default Editor Package Guidelines

- This package owns the standard editor composition: compiler integration, runtime selection, example source discovery,
  standard-library resolution, and browser persistence.
- Export composition APIs without mounting as an import side effect.
- Compose the standard plugin set here and expose host overrides through `plugins`; keep feature logic in its
  plugin package and generic plugin installation in editor-core.
- Construct the standard set with `createDefaultEditorPlugins` per mounted editor, supplying the canvas, render
  callback, project save/export callbacks, and WebAssembly export callback. Render callbacks run after initialization.
- Keep one project file service shared by Open, Save, and Export so imported handles and Save As destinations stay
  associated with the editor. Pass file-writing callbacks to plugin factories, not core state.
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
- Include `assertionMarkersPlugin`, `createKeyboardMemoryPlugin({ inputTarget: canvas })`, and
  `createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })` in the standard set. Use the canvas's browser
  navigator and live compiler getters. MIDI owns WASM instantiation and caching; core has no separate environment-plugin system.
