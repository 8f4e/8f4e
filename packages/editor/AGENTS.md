# Repository Guidelines

## Package Scope & Layout

- Path: `packages/editor`; this is an organizational parent for editor-owned packages.
- Editor libraries and hosts live in `packages/`. Optional feature plugins live in `plugins/<feature>/`, each with
  its own package named `@8f4e/editor-plugin-<feature>`. Keep plugin directories short and package names explicit.
- `@8f4e/editor-core` is the minimal reusable editor.
- `@8f4e/editor-plugin-compiler` owns compilation scheduling, worker communication, current artifacts, diagnostics, and statistics. The default composition constructs and installs it first, passing stable handles to dependent feature and runtime plugins. Core announces compilation input changes and consumes accepted rendering artifacts; it has no compile callback.
- `@8f4e/editor-palette` owns pure palette validation and predefined shades; drawers use its shared tokens.
- Keep `@8f4e/editor-palette` external in bundled editor libraries so the final composition can share one palette module.
- External lists match exact import paths; include used dependency subpaths such as `glugglugglug/utils` explicitly.
- `@8f4e/editor-default` composes the core with compiler, worker, runtimes, standard library, example source discovery,
  and startup policy.
- `@8f4e/editor-minimal` independently composes the embedded editor for the product homepage and galleries. Keep live
  editing, controls, visualizations, compiler/runtime plugins, input, and URL loading. Keep session storage, built-in
  modules, file/export/screenshot plugins, and optional authoring actions in editor-default.
- `@8f4e/editor-website` is the thin deployable Vite host for the default composition.
- `@8f4e/editor-webmcp` is an external, page-owned adapter bound to one editor's public editing handle. Hosts own its registration and dispose it before replacing the editor; it is not an editor plugin.
- The bridge bundles its help, compiler/editor documentation, and example catalogs using `@8f4e/vite-plugin-sources` at build time. Its `generate-content` target prepares the search index and lazy content modules before build/test/typecheck; hosts need no content configuration.
- `@8f4e/editor-plugin-toggle-skip-execution` owns the optional single-module execution toggle. The switch widget
  lives in `@8f4e/editor-plugin-switch`, momentary buttons in `@8f4e/editor-plugin-button`, waveforms in
  `@8f4e/editor-plugin-wave`, piano keyboards in `@8f4e/editor-plugin-piano`, sliders in `@8f4e/editor-plugin-slider`,
  selected-line tooltips in `@8f4e/editor-plugin-tooltips`, browser screenshots in `@8f4e/editor-plugin-screenshot`,
  project Open/Save/Export and browser file access in `@8f4e/editor-plugin-project-files`, and WebAssembly export in `@8f4e/editor-plugin-wasm-export`.
  Meter, plot, bars, crossfade, watch, and stack each live in their matching `editor-plugin-<name>` packages.
  Favorite detection, editing, and navigation live in `editor-plugin-favorites`, and memory-default disconnection in
  `editor-plugin-remove-memory-connections`. Core has no favorite-specific block state or menus.
  Visual `@group` behavior lives in `editor-plugin-grouping`, including private membership, drag and paste policies,
  and group action menus. Nested language-level project groups remain in core.
  `editor-plugin-binary-assets` owns binary fetching, caching, memory loading, dialogs, and size constants.
  Assertion marker drawing lives in `editor-plugin-assertion-markers`, keyboard-to-memory input in
  `editor-plugin-keyboard-memory`, and MIDI discovery/input in `editor-plugin-midi-input`. These use the same plugin
  contract; there is no separate environment-plugin manager. Assertion results and inline diagnostics remain core.
  Plugin contracts and installation live in `editor-core`,
  generic directive processing in `editor-state`, and drawer hooks in `web-ui`.
  `editor-plugin-lazy-loader` scans cached directives automatically after project changes and group navigation.
  Explicit registry scopes match visual/control plugins in the current project level and runtime/MIDI/asset plugins
  across the project tree. Matching plugins stay installed until editor disposal. Both editor compositions' lightweight registries dynamically import plot, wave,
  meter, bars, switch, button, piano, slider, and crossfade for their directives, plus MIDI, binary assets, and runtime
  plugins for their raw config roots.
  `editor-plugin-connectors` owns input/output geometry, private connector state, wire lookup, and all line GPU
  resources. Both compositions install it in their fixed plugin set. Web-ui provides generic render-layer lifecycle.
  Core provides independent layout contributions and subscriptions; directive parsing and layout remain separate.
  Session restoration/autosaving and project URL loading live in `editor-plugin-session-persistence` and
  `editor-plugin-project-url-loader`. The default host supplies storage/fetch and chooses initial URL priority.
  The standard plugin set is composed in `editor-default`.
  `editor-plugin-example-modules` owns built-in block menus, catalog metadata, lazy source caching, public-block
  selection, and dependency insertion. The default editor supplies source loaders; core owns generic submenu registration.

## Build, Test, Dev

- Build or test the composition with `npx nx run @8f4e/editor-default:build|test|typecheck`.
- Build or verify the embedded composition with `npx nx run @8f4e/editor-minimal:build|test|typecheck` and
  `npx nx run @8f4e/8f4e-website:test:browser`.
- Build or verify the plugins with `npx nx run @8f4e/editor-plugin-toggle-skip-execution:build|test|typecheck` or
  `npx nx run @8f4e/editor-plugin-switch:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-tooltips:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-button:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-wave:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-piano:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-slider:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-screenshot:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-project-files:build|test|typecheck`, or
  `npx nx run @8f4e/editor-plugin-wasm-export:build|test|typecheck`.
- Verify example module browsing with `npx nx run @8f4e/editor-plugin-example-modules:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-example-modules:test:screenshot`.
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
  Each also has a `test:screenshot` target for its canvas menu interaction.
- Verify connectors and their line renderer with `npx nx run @8f4e/editor-plugin-connectors:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`.
- Verify visual grouping with `npx nx run @8f4e/editor-plugin-grouping:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-grouping:test:screenshot`.
- Verify lazy plugin loading with `npx nx run @8f4e/editor-plugin-lazy-loader:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-lazy-loader:test:screenshot`.
- Build or preview it with `npx nx run @8f4e/editor-website:build|serve`.
- Ensure dependency packages are built before relying on workspace aliases in the website.

## Coding Style

- TypeScript (ES modules). Use Biome as the fixer (`npx biome check --write <files>`).
- Keep composition behavior in `editor-default` and `editor-minimal`; keep hosting and deployment concerns in their websites.
- Prefer workspace aliases for inter-package references.

## Testing

- Vitest tests live under `src/__tests__` or alongside source as `*.test.ts`.
- Test composition behavior in `@8f4e/editor-default` and `@8f4e/editor-minimal`; test reusable editor behavior in `@8f4e/editor-core`.

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

- Per-frame WASM execution and `@texture` framebuffer views belong entirely to `editor-plugin-texture-runtime`.
  Its `textureRuntime` config owns only `enabled` and `entry`; each directive owns its framebuffer, format, dimensions,
  and integer magnification. Both compositions load it lazily from `@texture` or raw `textureRuntime` config with
  project scope and compiler getters. Layout contributions reserve rows and a minimum block width; private views
  resolve memory in the containing block's scope. One GPU program and rectangle serve all 1bit/mono/rgb/rgba views.
  The generic overlay pass executes the entry once per editor frame and draws visible textures at block-relative
  positions above the editor, without block occlusion. Rendering remains active when entry execution is disabled.
  Keep parsing and memory lookup outside the frame path; release storage for removed/offscreen views and on GPU release.
