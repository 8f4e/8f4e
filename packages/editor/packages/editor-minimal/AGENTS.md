# Minimal Editor Package Guidelines

- Own the embedded composition for the product homepage and example/test galleries. Build directly on editor-core;
  do not import editor-default or its built-in module catalog.
- Keep live editing and runtime controls available. Let the project's `@mode` directive select its initial mode
  (view by default), and disable project creation by default.
  Hosts own wheel capture, mode-toggle preferences, page URLs, loading UI, visibility, and WebMCP registration.
- Construct the compiler first and inject its live handles into dependent plugin factories. Return the core editor
  with its compiler diagnostic getter; plugin disposal owns compiler, input, and runtime cleanup.
- Keep standard-library discovery in this package's Vite configuration and lazy include resolver. There is no
  example-module source collection here.
- Keep project signals and dynamic imports in `src/lazy-plugins.ts`. Plugins own feature logic; the existing loader
  owns activation and disposal. Match all wave variants and raw `midi`, `bin`, and runtime config roots before their
  schemas load. Declare `scope: 'view'` for visual/control plugins and `scope: 'project'` for runtime, MIDI, and
  asset plugins. Match cached directives; completed project changes and group navigation trigger automatic scans.
  Supply the browser navigator and live compiler getters to the registry for MIDI and binary assets.
- Supply the canvas and browser navigator to input plugins, memory getters to binary assets, and the compiler memory
  writer to interactive controls. Install watch/stack overlays before tooltips.
- The project URL plugin owns fetching. Forward initial-project callbacks; mounting does not wait for the fetch.
  Without a URL, start empty and announce readiness after initialization.
- Keep session storage, file/export/screenshot plugins, built-in module browsing, grouping, and optional editing
  actions in editor-default. Add no storage options, callbacks, or compatibility wrappers here.
- Verify with `npx nx run @8f4e/editor-minimal:build|test|typecheck`. The product website's `test:browser` target covers
  real compiler execution, URL loading, lazy controls/runtimes, editing, bridge lifecycle, and disposal.

- Install `connectorsPlugin` in the fixed plugin set. It owns all input/output widgets and GPU wire rendering;
  core owns only generic render-layer lifecycle.
