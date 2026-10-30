# Repository Guidelines

## Project Structure & Module Organization
- Editor product: the reusable default composition lives in `packages/editor/packages/editor-default/`; the thin
  Vite website lives in `packages/editor/packages/editor-website/`.
- Embedded composition: `packages/editor/packages/editor-minimal/` supplies live editing, project URL loading,
  controls, visualizations, and runtimes for the product homepage and galleries, without session storage or authoring plugins.
- Compiler integration lives in `packages/editor/plugins/compiler/` (`@8f4e/editor-plugin-compiler`). The default editor constructs and installs it first and injects its live handles into dependent plugins, including runtimes. Core emits input-change events and consumes accepted artifacts.
- WebMCP lives in `packages/editor/packages/editor-webmcp/` as an external page-owned adapter bound to one editor's public `editing` handle. The editor website and example/test galleries compose it; gallery project switches dispose and recreate the bridge.
- Optional editor features live in `packages/editor/plugins/<feature>/` as independent npm/Nx packages named
  `@8f4e/editor-plugin-<feature>`.
- `editor-plugin-lazy-loader` automatically matches cached editor directives after project changes and group navigation.
  Visual/control plugins use the current project level; runtime, MIDI, and asset plugins use the entire project tree.
  Both editor compositions keep explicit loading scopes, lazy signals, and dynamic imports in `src/lazy-plugins.ts`
  for plot, wave, meter, bars, switch, button, piano, slider, crossfade, MIDI input, binary assets, and the
  audio/worker/test/texture runtimes. MIDI, assets, and texture execution match raw `midi`,
  `bin`, and `textureRuntime` config roots before their schemas load. Other plugins remain fixed.
- Editor visual grouping (`; @group`) lives in `editor-plugin-grouping`, including menus, actions, drag-target
  selection, and paste collision renaming. Nested language-level project groups remain core project structure.
- Product website: `packages/8f4e-website/` is a Vite site with a homepage, an `/examples/` gallery, and a `/tests/`
  compiler fixture gallery, all embedding the minimal editor. Its build includes `src/index.html`,
  `src/examples/index.html`, and `src/tests/index.html`. The test gallery bundles the compiler's `.test.8f4e`
  fixtures as assets; fixtures enable the test-runtime plugin with `@config testRuntime.enabled true` to run assertions
  after compilation.
- Reusable Vite source discovery lives in `packages/vite-plugin-sources/`. It exposes lazy text collections through
  `virtual:8f4e-sources/<name>`; the default editor uses it for stdlib includes and example modules.
- Editor colors: `@8f4e/editor-palette` owns the pure base palette and predefined shades. Configure only shared base
  colors; core and plugin drawers select generic palette tokens. Shades are uploaded as premultiplied colors in a GPU
  uniform buffer (up to 256 entries); the sprite atlas contains color-independent R8 binary visibility masks.
- Rendering plugins: web-ui owns the procedural background and its font-specific dot settings under `src/plugins/`.
  `editor-plugin-connectors` owns input/output widgets, wire lookup, and the complete line renderer. Web-ui provides
  generic render-layer registration, palette updates, memory release, and disposal.
  Glugglugglug owns sprite rendering and generic render hooks. The sprite generator supplies only a uniform grid of
  glyph/fill masks; background patterns do not occupy the sprite atlas. Glyph IDs are ASCII codes 0–127 and fill is 128;
  editor state carries no sprite lookup tables. The renderer derives source
  coordinates from grid dimensions without a rectangle lookup texture.
- Packages (Nx workspaces): `packages/*` plus nested libs (e.g., `editor`, `compiler`,
  `editor/packages/editor-core/packages/web-ui/packages/glugglugglug`). Each builds to its own `dist/` directory
  under the package root.
- Builds: the website outputs to `packages/editor/packages/editor-website/dist/`. Package bundles are consumed via
  aliases like `@8f4e/editor-default` and `@8f4e/editor-core`.
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
- `npx nx run @8f4e/8f4e-website:dev`: Starts the example product website on `http://localhost:3001`.
- `npx nx run @8f4e/8f4e-website:build`: Builds the example product website and its editor dependencies.
- `npx nx run @8f4e/editor-minimal:build|test|typecheck`: Build or verify the embedded editor composition.
- `npx nx run @8f4e/8f4e-website:test:browser`: Runs homepage and gallery lifecycle integration tests with the minimal editor.
- `npx nx run @8f4e/editor-webmcp:test:browser`: Runs real-editor WebMCP source, editing, revision, persistence, and history integration tests.
- `npx nx run @8f4e/editor-webmcp:build|test|typecheck`: Verify the external single-editor WebMCP adapter.
- `npx nx run @8f4e/editor-webmcp:generate-content`: Rebuild its bundled help/docs/example catalog through Vite source collections; build/test/typecheck run this automatically.
- `npm --prefix tools/project-preview run generate-gallery-previews`: Regenerates 64×64 GIF icons for the example
  and compiler test galleries with the standalone npm tool.
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
- Files/dirs: kebab-case for packages, `.ts` for sources; keep `src/` clean and cohesive by domain.

## Testing Guidelines
- Framework: Vitest with built-in ESM support and first-class Vite integration.
- Locations: `**/__tests__/**` or `*.test.ts` / `*.spec.ts` alongside sources.
- Run: `npm test` (all) or `npx vitest` inside a package.
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

- Per-frame WASM execution and framebuffer rendering belong entirely to `editor-plugin-texture-runtime`: `textureRuntime` config schema,
  WebAssembly execution, RGBA shaders and textures, uploads, and placement. Both compositions load it lazily from
  the raw `textureRuntime` config root with project scope and compiler getters. Core consumes compilation memory
  for generic views; web-ui only owns generic render-layer lifecycle. Keep configuration and instantiation out
  of the render hot path, and register texture drawing after connectors to preserve overlay ordering.
