# Repository Guidelines

## Package Scope & Layout

- Path: `packages/editor`; this is an organizational parent for editor-owned packages.
- Editor libraries and hosts live in `packages/`. Optional feature plugins live in `plugins/<feature>/`, each with
  its own package named `@8f4e/editor-plugin-<feature>`. Keep plugin directories short and package names explicit.
- `@8f4e/editor-core` is the minimal reusable editor.
- `@8f4e/editor-plugin-compiler` owns compilation scheduling, worker communication, current artifacts, diagnostics, and statistics. The default composition constructs and installs it first, passing stable handles to dependent plugins and runtime factories. Core announces compilation input changes and consumes accepted rendering artifacts; it has no compile callback.
- `@8f4e/editor-palette` owns pure palette validation and predefined shades; drawers use its shared tokens.
- `@8f4e/editor-default` composes the core with compiler, worker, runtimes, standard library, example source discovery,
  and startup policy.
- `@8f4e/editor-website` is the thin deployable Vite host for the default composition.
- `@8f4e/editor-webmcp` is an external, page-owned adapter bound to one editor's public editing handle. Hosts own its registration and dispose it before replacing the editor; it is not an editor plugin.
- `@8f4e/editor-plugin-toggle-skip-execution` owns the optional single-module execution toggle. The switch widget
  lives in `@8f4e/editor-plugin-switch`, momentary buttons in `@8f4e/editor-plugin-button`, waveforms in
  `@8f4e/editor-plugin-wave`, piano keyboards in `@8f4e/editor-plugin-piano`, sliders in `@8f4e/editor-plugin-slider`,
  selected-line tooltips in `@8f4e/editor-plugin-tooltips`, browser screenshots in `@8f4e/editor-plugin-screenshot`,
  project Open/Save/Export and browser file access in `@8f4e/editor-plugin-project-files`, and WebAssembly export in `@8f4e/editor-plugin-wasm-export`.
  Meter, plot, bars, crossfade, watch, and stack each live in their matching `editor-plugin-<name>` packages.
  Favorite editing lives in `editor-plugin-toggle-favorite`, and memory-default disconnection in
  `editor-plugin-remove-memory-connections`. Favorite navigation and directive derivation remain core features.
  `editor-plugin-binary-assets` owns binary fetching, caching, memory loading, dialogs, and size constants.
  Assertion marker drawing lives in `editor-plugin-assertion-markers`, keyboard-to-memory input in
  `editor-plugin-keyboard-memory`, and MIDI discovery/input in `editor-plugin-midi-input`. These use the same plugin
  contract; there is no separate environment-plugin manager. Assertion results and inline diagnostics remain core.
  Plugin contracts and installation live in `editor-core`,
  generic directive processing in `editor-state`, and drawer hooks in `web-ui`.
  Session restoration/autosaving and project URL loading live in `editor-plugin-session-persistence` and
  `editor-plugin-project-url-loader`. The default host supplies storage/fetch and chooses initial URL priority.
  The standard plugin set is composed in `editor-default`.
  `editor-plugin-example-modules` owns built-in module menus, catalog metadata, lazy source caching, public-block
  selection, and dependency insertion. The default editor supplies source loaders; core owns generic submenu registration.

## Build, Test, Dev

- Build or test the composition with `npx nx run @8f4e/editor-default:build|test|typecheck`.
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
- Verify the WebMCP adapter with `npx nx run @8f4e/editor-webmcp:build|test|typecheck` and gallery switching with `npx nx run @8f4e/8f4e-website:test:browser`.
- Verify binary assets with `npx nx run @8f4e/editor-plugin-binary-assets:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-binary-assets:test:screenshot`.
- Verify assertion markers and input plugins with
  `npx nx run-many --targets=build,test,typecheck --projects=@8f4e/editor-plugin-assertion-markers,@8f4e/editor-plugin-keyboard-memory,@8f4e/editor-plugin-midi-input`.
  Assertion markers also have a `test:screenshot` target; MIDI tests require no hardware.
- Verify the favorite and memory-connection actions with
  `npx nx run-many --targets=build,test,typecheck --projects=@8f4e/editor-plugin-toggle-favorite,@8f4e/editor-plugin-remove-memory-connections`.
  Each also has a `test:screenshot` target for its canvas menu interaction.
- Build or preview it with `npx nx run @8f4e/editor-website:build|serve`.
- Ensure dependency packages are built before relying on workspace aliases in the website.

## Coding Style

- TypeScript (ES modules). Use Biome as the fixer (`npx biome check --write <files>`).
- Keep composition behavior in `editor-default`; keep hosting and deployment concerns in `editor-website`.
- Prefer workspace aliases for inter-package references.

## Testing

- Vitest tests live under `src/__tests__` or alongside source as `*.test.ts`.
- Test composition behavior in `@8f4e/editor-default`; test reusable editor behavior in `@8f4e/editor-core`.

## Pull Requests

- Include test notes and explain any package-boundary changes.
- Add screenshots or GIFs when editor behavior or appearance changes.
