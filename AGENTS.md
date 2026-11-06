# Repository Guidelines

## Project Structure & Module Organization
- Editor product: the reusable default composition lives in `packages/editor/packages/editor-default/`; the thin
  Vite website lives in `packages/editor/packages/editor-website/`.
- Gallery composition: `packages/editor/packages/editor-gallery/` supplies live editing, project URL loading,
  controls, visualizations, runtimes, and project source saving/export for the galleries, without session storage
  or the default editor's other authoring plugins.
- Landing composition: `packages/editor/packages/editor-landing/` supplies live editing, compilation, URL loading,
  the worker runtime, watch/stack, plot, and slider controls for the product homepage. Projects are self-contained;
  landing omits standard-library discovery and include resolution. It also omits switch, button, piano,
  assertion markers, keyboard mode switching, dialogs, test/audio/texture runtimes, binary assets, MIDI input,
  keyboard-memory, bars, meter, wave, and crossfade, plus gallery authoring/menu/file plugins and loading indicators.
  Plain-text paste remains in keyboard editing. It keeps core's `contextMenu` feature disabled to prevent invisible menus from blocking input.
- Compiler integration lives in `packages/editor/plugins/compiler/` (`@8f4e/editor-plugin-compiler`). The default editor constructs and installs it first and injects its live handles into dependent plugins, including runtimes. Core emits input-change events and consumes accepted artifacts.
- WebMCP lives in `packages/editor/packages/editor-webmcp/` as an external page-owned adapter bound to one editor's public `editing` handle. The editor website and example/test galleries compose it; gallery project switches dispose and recreate the bridge.
- Optional editor features live in `packages/editor/plugins/<feature>/` as independent npm/Nx packages named
  `@8f4e/editor-plugin-<feature>`.
- Plugin documentation owns factory dependencies, loading signals, and lifecycle contracts. Keep editor counts and
  lists of consuming compositions out of plugin docs; composition packages document which plugins they select.
- `editor-plugin-lazy-loader` automatically matches cached editor directives after project changes and group navigation.
  Visual/control plugins use the current project level; runtime, keyboard-memory, MIDI, and asset plugins use the entire project tree.
  Default and gallery compositions keep explicit loading scopes, lazy signals, and dynamic imports in `src/lazy-plugins.ts`
  for plot, wave, meter, bars, watch, stack, switch, button, piano, slider, crossfade, keyboard-memory, MIDI input, binary assets, and the
  audio/worker/test/texture runtimes. Keyboard-memory matches raw `keyboard` configuration before its schema loads.
  MIDI, assets, and texture execution match raw `midi`,
  `bin`, and `textureRuntime` config roots before their schemas load. Texture uploads and views also match `@textureUpload` and `@texture`. Editor compositions defer optional UI, input, and authoring plugins until after the first render.
  Compiler coordination, project loading/restoration, block backgrounds, and code rendering remain eager.
  Loading indicators are eager in default and gallery; landing omits their presentation/visibility plugin.
  All optional imports, including directive-based lazy plugins, start on core's `ready` event, after initial project
  loading/parsing, font-atlas loading, and rendering. Font payloads remain separate lazy chunks; do not add frame
  callbacks or timing gates.
- UI event subscriptions use numeric layers matching drawer stages. Higher layers run first; capture/normal handlers
  inside each layer run in reverse registration order. Unlayered notifications and default effects retain their ordering.
  Plugins receive configurable layers at factory construction where needed. Drawing remains in registration order;
  code-block targeting already follows the reverse of block stacking. `INPUT_LAYERS` lives in editor-state-types.
- `editor-plugin-block-authoring` owns New Module/Function/Prototype/Note templates, random names, Delete, and
  their menu contributions. Default and gallery load it after `ready`; landing omits it. Generic insertion/deletion,
  entry assignment, layout, revisions, and history stay in editor-state. Folding and shared source/display mappings
  remain in editor-state.
- Editor visual grouping (`; @group`) lives in `editor-plugin-grouping`, including menus, actions, drag-target
  selection, and group copying. Nested language-level project groups remain core project structure.
- Product website: `packages/8f4e-website/` is a Vite site with a homepage embedding the landing editor, plus an
  `/examples/` gallery and a `/tests/` compiler fixture gallery embedding the gallery editor. Its build includes `src/index.html`,
  `src/examples/index.html`, and `src/tests/index.html`. The test gallery bundles the compiler's `.test.8f4e`
  fixtures as assets; fixtures enable the test-runtime plugin with `@config testRuntime.enabled true` to run assertions
  after compilation.
  The homepage imports only its four demo project URLs through `src/homepage-projects.ts`; keep the full example
  project and preview catalogs in the examples gallery's import graph.
  Keep homepage featured preview GIFs external with `?no-inline` so native image lazy loading can defer their bytes.
- Reusable Vite source discovery lives in `packages/vite-plugin-sources/`. It exposes lazy text collections through
  `virtual:8f4e-sources/<name>`; the default editor uses it for stdlib includes and example modules.
- Editor colors: `@8f4e/editor-palette` owns the pure base palette and predefined shades. Configure only shared base
  colors; core and plugin drawers select generic palette tokens. Shades are uploaded as premultiplied colors in a GPU
  uniform buffer (up to 256 entries); the sprite atlas contains color-independent R8 binary visibility masks.
- Web-ui owns font/color schemas, validators, defaults, atlas loading, and palette subscriptions. Core registers
  `registerWebUiConfig(store)` before plugin setup and initializes the renderer with the store and event dispatcher.
  State keeps config values generic and responds to `gridSizeChanged` for shared geometry, without font/atlas knowledge.
- `@8f4e/editor-plugin-code-rendering` owns code/notes text, syntax highlighting, nested block backgrounds,
  line-number drawing, and private prepared sprite cells and highlight rectangles. Editor compositions install it eagerly.
  Core retains editing/layout geometry. Web-ui invokes one `registerCodeBlockDrawer` registry in registration order
  within its existing visible-block loop. The eager `code-block-background` plugin is installed before code rendering.
  Code rendering owns selected-line fill; code-block-background owns corner markers. The deferred
  `offscreen-block-arrows` plugin owns arrow placement and drawing through a single replaceable
  `registerOffscreenCodeBlockDrawer` callback in the same traversal. `canvasOverlays` also controls offscreen decorations.
- Layout completion events carry `{ project, codeBlocks }` identifying the owning `ProjectLevel` and only blocks whose
  source/display rows, layout contributions, and positions have settled. The editor-state layout coordinator owns
  group membership and per-group anchored-block tracking; viewport movement repositions only the active group's anchors.
  Rendering consumers refresh the listed blocks only; active-view consumers compare project identity directly.
- Lifecycle event payloads are inferred from `EditorLifecycleEvents` in editor-state-types. Source-edit helpers take
  `{ store, events }` and emit `codeBlockSourcesChanged { codeBlocks }` for the changed batch before compiler/project
  revisions. Programmatic edits have no selection state or selection-based notification path.
- Editor-state owns `codeBlockRendering.entryBounds`, including padding, updates, and insertion hit testing.
  `@8f4e/editor-plugin-entry-outlines` only draws borders and labels through `registerCanvasBackgroundDrawer` below blocks.
  The default and gallery compositions defer drawing until `ready`; entry assignment works independently of the plugin.
- `@8f4e/editor-plugin-context-menu` owns menu labels, sizing, grid snapping, viewport clamping, hover state, hit testing,
  and drawing. Core keeps raw items, requested world anchors, menu navigation, input blocking, and action/selector dispatch.
  The default and gallery compositions defer it until `ready`. Web-ui exposes `registerContextMenuOverlay` above editor overlays and below modal dialogs.
- `@8f4e/editor-plugin-dialogs` owns dialog dimensions, wrapping/clipping, private button geometry/hit testing,
  and drawing. Editor-state owns dialog content/stack, opening/closing, button actions, and modal input blocking.
  Default and gallery compositions load dialogs through their unconditional deferred registries after `ready`. Web-ui supplies
  `registerModalOverlay` after context-menu overlays, independently of `canvasOverlays`.
- Loading operations contribute `{ id, message }` through `loading.add` in the plugin setup context.
  The returned handle exposes `done()`, `fail()`, and `cancel()`; the first terminal result records `finishedAt`.
  State retains `status`, `startedAt`, and `finishedAt` in the unified `state.loadingIndicators` list. Reusing an ID
  replaces its entry; old handles cannot update the replacement. The eager `editor-plugin-loading-indicators` owns
  prepared elapsed-time/status drawing and private visibility bookkeeping; it never deletes state contributions.
  Done results hide after 1/2/3 seconds for operations lasting up to 100 ms, over 100 ms through 500 ms, or over
  500 ms respectively; failed/cancelled hide after five seconds. Expired items hide oldest finish first at 25 ms
  intervals. Hiding sleeps until needed and runs independently of drawing; same-ID replacements become visible again.
- `@8f4e/editor-plugin-error-messages` owns inline error wrapping, layout reservations, coordinates, and drawing.
  Core retains raw `CodeError` lists in `state.codeErrors`, keyed by contributor. Compiler, editor directives, and
  test-runtime own their lists; editor compositions defer the presentation plugin until `ready`.
- `@8f4e/editor-plugin-jump-to-error` owns the fixed error-navigation button and centers the first error's source line
  using core display rows and gaps. It is independent of error-message presentation. Default and gallery defer it
  until `ready`; landing omits it.
- `@8f4e/editor-plugin-selection-animation` owns the circling segment around the selected block, using the generic
  ordered block drawer hook. Its deferred entries are commented out in default/gallery and omitted from landing; core retains selection state and geometry.
- Ordinary keyboard input lives in `keyboard-navigation`, `keyboard-editing`, and `keyboard-mode-switching` plugins.
  Default/gallery import all three factories after the first render only when `(pointer: coarse)` does not match;
  landing imports navigation and editing only. Editing keeps
  a small input bridge and loads text editing on first edit mode, buffering keystrokes during the import. Core retains
  history, project editing APIs, generic mode/navigation actions, and shared text/pointer geometry. The mode-switching
  plugin owns its hint through the generic canvas-overlay hook; `canvasOverlays` controls that drawing stage. The editing plugin owns caret movement, horizontal caret placement, and foreground drawing;
  navigation handles view-mode line selection and block navigation. `includeKeyboardModeSwitching: false` omits
  mode switching from default/gallery; its presence controls availability without a core feature flag.
- DOM mouse/wheel forwarding belongs to `editor-plugin-mouse-input`, loaded on all devices. Coarse-pointer devices
  additionally load `editor-plugin-touch-input` for one-finger viewport dragging with tap preservation.
  Both are independent entries in each composition's deferred registry. Core retains event dispatch, pointer-input
  state effects, viewport updates, and snapping; `captureWheel` is a mouse-plugin factory/host option.
- The default editor also imports `editor-plugin-font-preview` for non-coarse pointers. F18/F19 cycle a temporary font
  override without modifying source; project loading or plugin disposal restores source configuration. Gallery and landing omit it.
- Rendering plugins: web-ui owns the procedural background and its font-specific dot settings under `src/plugins/`.
  Editor-core owns the single frame loop and advances viewport state before web-ui draws each frame. Web-ui owns
  drawing and GPU resources, with no frame scheduler or navigation-state updates.
  `editor-plugin-connectors` owns input/output widgets, shape/paramShape label layout and drawing, wire lookup, and
  the complete line renderer. Core has no widget presentation fields. Web-ui provides
  generic render-layer registration, palette updates, memory release, and disposal.
  Glugglugglug owns sprite rendering and generic render hooks. The sprite generator supplies only a uniform grid of
  glyph/fill masks; background patterns do not occupy the sprite atlas. Glyph IDs are CP437 slots 0–255 and fill is 256;
  one shared Unicode-to-CP437 mapping resolves text; missing font glyphs remain blank.
  Prepare static text with the pure `textToGlyphIds` helper outside drawers and render callbacks, keeping results in
  the owning plugin's existing preparation data. Live numeric readouts use ASCII character codes directly as glyph IDs,
  trusting the caller's numeric-text contract without validation or Unicode mapping.
  Editor state carries no sprite lookup tables. The renderer derives source
  coordinates from grid dimensions without a rectangle lookup texture.
- Packages (Nx workspaces): `packages/*` plus nested libs (e.g., `editor`, `compiler`,
  `editor/packages/editor-core/packages/web-ui/packages/glugglugglug`). Each builds to its own `dist/` directory
  under the package root.
- Builds: the website outputs to `packages/editor/packages/editor-website/dist/`. Package bundles are consumed via
  aliases like `@8f4e/editor-default` and `@8f4e/editor-core`.
- The editor website owns PWA installation and offline caching. Precache the complete production build while keeping
  plugin/font imports lazy. Register after mounting, retain COOP/COEP on cached pages, and apply updates on request.
- `editor-plugin-pwa-updates` observes a page-owned service worker and owns its update dialog and menu action.
  The default composition loads it after the first render only when the host supplies `pwaUpdates`. First installation
  is silent; registration, caching, and controller-change reloads remain website concerns.
- Package builds clear their own `dist/` before emitting output. Plain TypeScript builds use `rm -rf dist && tsc`.
  Mixed builds clean once before the first emitter so later TypeScript or Vite steps preserve earlier assets and declarations.
- Docs and assets: `docs/`, selected files copied via Vite static-copy.
- Example builds generate module sources without precompiling project WASM files. The default editor discovers
  `.8f4em` sources through `@8f4e/vite-plugin-sources` and supplies lazy loaders to the example-modules plugin,
  which derives its catalog from paths and loads source chunks on demand. Modules ship with the website builds.
  The product website owns the project catalog and bundles `.8f4e` project sources as downloadable assets. Both
  consumers depend on `@8f4e/examples` so source changes are included in build cache inputs and dependency watches.
- Nested `AGENTS.md` files exist in some packages to provide package-specific guidance; they extend (and may override) this root file for their scope.

## Agent Skills
- Reusable, vendor-neutral agent guidance lives in `docs/agent_skills/`.
- When validating human or automated review comments before making code changes, use `docs/agent_skills/validate-review-comments.md`.
- When prepending or inserting document text, use `docs/agent_skills/context-aware-document-inserts.md` to preserve reading order and avoid unexplained forward references.

## Build, Test, and Development Commands (Nx-first)
- `npx nx run @8f4e/editor-website:dev`: Builds packages (watch) and starts Vite on `http://localhost:3000`.
- `npx nx run @8f4e/editor-website:serve`: Serves the production build via `vite preview`.
- `npx nx run @8f4e/editor-website:build`: Builds the default composition and website production bundle.
- `npx nx run @8f4e/editor-website:test:browser`: Tests the production PWA cache, offline startup/lazy loading, runtime
  execution, session restoration, and updates in desktop Chromium and Android touch emulation on port 3103.
- `npx nx run @8f4e/8f4e-website:dev`: Starts the example product website on `http://localhost:3001`.
- `npx nx run @8f4e/8f4e-website:build`: Builds the example product website and its editor dependencies.
- `npx nx run @8f4e/editor-core:test:screenshot`: Tests viewport animation and culling through the real core/renderer.
- `npx nx run @8f4e/editor-default:test:screenshot`: Runs real-plugin browser composition tests for lazy loading,
  project Open/Save, and compiler/texture rendering.
- `npx nx run @8f4e/editor-gallery:build|test|typecheck`: Build or verify the embedded editor composition.
- `npx nx run @8f4e/editor-landing:build|test|typecheck`: Build or verify the landing-page editor composition.
- `npx nx run @8f4e/8f4e-website:test:browser`: Runs homepage and gallery lifecycle integration tests with the landing and gallery editors.
- `npx nx run @8f4e/editor-webmcp:test:browser`: Runs real-editor WebMCP source, editing, revision, persistence, and history integration tests.
- `npx nx run @8f4e/editor-webmcp:build|test|typecheck`: Verify the external single-editor WebMCP adapter.
- `npx nx run @8f4e/editor-webmcp:generate-content`: Rebuild its bundled help/docs/example catalog through Vite source collections; build/test/typecheck run this automatically.
- `npm --prefix tools/project-preview run generate-gallery-previews`: Regenerates 64×64 GIF icons for the example
  and compiler test galleries with the standalone npm tool.
- `node tools/dx7-to-8f4e/src/cli.ts <bank.syx> --algorithm 5`: Converts DX7 single-voice or bank dumps into
  movable constants blocks. This standalone tool uses Node built-ins; validate it with
  `npm --prefix tools/dx7-to-8f4e test` and `npm --prefix tools/dx7-to-8f4e run typecheck`.
- `npx nx run @8f4e/release:check --parallel=2`: Runs release builds and metrics in parallel with
  tests and coverage on one runner.
- `npx nx run @8f4e/vite-plugin-sources:build|test|typecheck`: Build or verify the reusable source collection plugin.
- `npx nx run-many --target=build --all`: Build all packages/libs.
- `npx nx run-many --target=test --all`: Run Vitest across all packages.
- `npx nx run @8f4e/examples:test`: Run CLI example-project snapshot tests, then embedded `#test` modules in
  example `.8f4em` files through the CLI test runner.
- `npx nx run-many --target=typecheck --all`: Type-check all packages; also run on pre-commit via Husky/lint-staged.
- `npx nx run-many --target=lint --projects=@8f4e/editor-default,@8f4e/editor-website`: Biome check/fix for the
  composition and website. Use `run-many --target=lint --all` to lint every project if needed.
- `npx nx graph`: Open Nx project dependency graph.
- `npx nx run @8f4e/editor-website:kill-dev`: Kill any dev server on port 3000.
- Production deployments run only in the manually dispatched `Release` GitHub Actions workflow on `main`, after
  release checks, builds, and the atomic release push succeed. It deploys 8f4e.com (`8f4e-website`) and
  editor.8f4e.com (`8f4e`), including bundled example modules, to Cloudflare Pages. Disable automatic production
  and preview deployments in Cloudflare's Git integration so pushes and merges do not deploy. See `docs/releasing.md`.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules). Target: modern browsers/node.
- Formatting/linting: use Biome as the fixer (`npx biome check --write <files>`). Biome owns the repo JS/TS formatting rules (tabs, single quotes, semicolons, trailing commas, width 120, and import organization); do not run standalone formatters.
- Imports: Prefer workspace aliases `@8f4e/<package>` for inter-package references.
- Repository-owned APIs are trusted contracts. Do not add defensive runtime validation for caller misuse;
  callers satisfy the documented inputs. Express those contracts with types and JSDoc.
- Files/dirs: kebab-case for packages, `.ts` for sources; keep `src/` clean and cohesive by domain.

## Build Inputs and Test Dependencies
- Production builds and generators use `production` inputs; tests retain their own `default` inputs and consume dependency `production` inputs. Type checks retain their own test files.
- Keep sample data local to the consuming tests when an integration with the source package is not under test. Do not copy dependency implementations or remove required test/build relationships. `devDependencies` still create Nx project graph edges.
- Test paths are excluded narrowly. Shipped compiler fixtures in the product test gallery, WebMCP catalogs/docs/examples, stdlib sources, bundled modules, workers, and worklets must remain explicit production inputs. Verify resolved inputs with `nx show target inputs <project>:<target> --json` after adding shipped assets or test conventions; see `docs/build-input-audit.md`.

## Testing Guidelines
- Framework: Vitest with built-in ESM support and first-class Vite integration.
- Locations: `**/__tests__/**` or `*.test.ts` / `*.spec.ts` alongside sources.
- Run: `npm test` (all) or `npx vitest` inside a package.
- Failure artifacts in `.vitest-attachments/` are ignored by the root `.gitignore`; keep reference screenshots tracked
  and avoid per-package attachment or obsolete screenshot-diff ignore rules.
- Configuration: Shared Vitest helpers live in `@8f4e/config/vitest`; per-package configs live in `vitest.config.ts`.
- Globals: Vitest globals enabled (`describe`, `it`, `expect`, `vi` for mocks/spies).
- Aim for meaningful unit tests around compiler/editor logic; snapshot tests OK for view models. Keep tests fast; no browser required.
- Note: The `glugglugglug` submodule maintains its own independent Vitest configuration.

## Commit & Pull Request Guidelines
- Commit messages: Use Conventional Commits.
- Features: `feat(package-name): <summary>` for package-specific changes, or `feat: <summary>` for non-package-specific changes.
- Fixes: `fix(package-name): <summary>` for package-specific changes, or `fix: <summary>` for non-package-specific changes.
- Release semantics are driven by Conventional Commits: `fix` triggers a patch release, `feat` triggers a minor release, and breaking changes (`!` or `BREAKING CHANGE`) trigger a major release. Nx release also bumps dependent packages automatically.
- For refactors, cleanup, dependency updates, and other maintenance that should be released, use `fix(...)` unless the change is truly feature-level.
- Use `chore(...)` only for work that should not cause a package release, such as repository maintenance with no shipped package impact.
- Use a non-release `chore(...)` scope, such as `chore(ci): ...` or `chore(tooling): ...`, for release workflow/configuration-only changes unless the change should intentionally release packages.
- Documentation-only changes: `docs: <summary>` or `docs(scope): <summary>`. These should not cause package releases.
- Generated release commits use `chore(release): ...`; do not use that scope for hand-written maintenance commits.
- PRs: Include summary, rationale, and test notes; link issues; add screenshots/gifs for UI/editor changes; update `docs/` when behavior or APIs change.

## Security & Configuration Tips
- Node: use `nvm use` (repo uses `v24.16.0`).
- Dev server: Vite sets COOP/COEP headers; prefer running only one instance on port `3000`.
- Browser preview ports: the metrics dashboard uses `3002`; sprite-generator screenshot tests start their own
  server on `3102` with strict port binding.
- Verify aliases resolve to built outputs: run package `build` before `vite build` when changing package APIs.

## Maintenance Note
- When changing tooling (e.g. build/test commands, Nx targets), remember to update relevant `AGENTS.md` files.
- Nested `AGENTS.md` files in packages should stay in sync with root guidance; update them when workflows or conventions change.

## Compiler Error Domains

Choose errors by detection phase:

- Use `SyntaxRulesError` and `SyntaxErrorCode` from `@8f4e/tokenizer` for token or argument-shape errors.
- Use `getError` and `ErrorCode` from `@8f4e/language-spec` when detection needs semantic context.
- Keep default messages in the central registries; add throw-site messages only for useful dynamic context.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

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

- Block copy/paste belongs to `editor-plugin-code-block-copy-paste`, composed by default and gallery with injected clipboard read/write functions. Grouping receives its own writer. Core has no clipboard callbacks or copy/paste actions; it exports pure `serializeCodeBlocks` and generic `insertCodeBlocks`. Pasting changes only `@pos` for placement: preserve declaration names, group names, references, and entry metadata without numbering or transform hooks.
- Keyboard-editing handles native plain-text paste at the caret through its loaded implementation. Do not buffer paste events or add loading-race handling.
