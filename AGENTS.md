# Repository Guidelines

## Project Map

- [Compiler](compiler/AGENTS.md) owns language parsing, analysis and WebAssembly compilation.
- The [CLI](apps/cli/README.md) exposes the compiler and execution tooling as command-line commands.
- [Editor](editor/AGENTS.md) owns reusable editing, browser runtime integration, optional plugins and
  editor compositions. The [editor web app](apps/editor-webapp/AGENTS.md) is the thin host for the default composition.
- The [product website](apps/8f4e-website/README.md) hosts the landing demos, example gallery and compiler fixture
  gallery. Keep full gallery catalogs out of the homepage build. Ship project sources as assets.
- [Examples](examples) ships project and module source. Consumers that discover these files depend on
  `@8f4e/examples` so generators and source changes participate in Nx builds and watches.
- [Example integration tests](examples/tests/README.md) own cross-package example regressions and depend on the CLI,
  compiler and source packages without pulling those consumers into the examples asset build. [Compiler benchmarks](tools/compiler-benchmarks/README.md)
  owns benchmark cases and measurement runners; keep both validation projects out of Nx releases.
- [Release tooling](tools/release/README.md) owns repository-wide release metrics and validation runners.
  Resolve measured packages by name rather than hardcoded repository paths.
- [Vite source collections](tools/vite-plugin-sources/AGENTS.md) provide reusable source discovery. Source
  selection and interpretation belong to consumers.
- [Linux runtime](apps/runtime-linux/AGENTS.md) owns native JACK playback. The separate
  [runtime command tool](apps/runtime-command/README.md) translates compiler metadata into numeric launch arguments.
- [Daisy runtime](apps/runtime-daisy/README.md) loads compiled instruments from microSD on the Daisy Field.
- The compiler ABI imports shared `host.memory` with explicit limits. Hosts allocate matching shared memory.

## Build and Development

- Use `nvm use` for the pinned Node version. Run Nx tasks from the repository root, for example
  `npx nx run @8f4e/editor-webapp:dev` (port 3000) or `npx nx run @8f4e/8f4e-website:dev` (port 3001).
  Preserve COOP/COEP where shared memory is used.
- Use `npx nx show project <project>` to find available targets. Use Nx builds so workspace aliases resolve to
  built exports, including when changing an API used by a Vite consumer.
- Keep package-owned Nx configuration in `package.json` under `nx`, so the npm package name is the project identity.
  Use `project.json` for non-npm projects and custom project-level metadata that Nx does not preserve in package
  manifests (the stdlib metrics source directory). Keep exceptional target options local.
- Use Nx's `command` shorthand for single-command targets. Inherit conventional working and build output directories,
  lint, typecheck and screenshot defaults; declare an empty target only when its shared command fits the project.
- Tests inherit the `^build` prerequisite. Only declare a `test.dependsOn` override when the target needs a different
  dependency sequence.
- Omit redundant Nx `sourceRoot` declarations; derive conventional `src/` directories from the discovered project root
  and run commands from `{projectRoot}`. Only nonstandard release-metric source directories require project-relative
  `metadata.metrics.sourceDirectory`. The standalone Glugglugglug submodule owns its own project metadata.
- Each package builds into its own `dist/`. Clear it before the first emitter (`rm -rf dist && tsc` for plain
  TypeScript packages). Mixed builds clean once so later steps preserve earlier outputs.
- Production builds and generators use `production` inputs. Tests and type checks retain their own test sources
  and consume production inputs from dependencies.
- Exclude test-only paths narrowly. Keep shipped fixtures, catalogs, stdlib, bundled modules, workers and
  worklets in production inputs. Verify changes with `nx show target inputs <project>:<target> --json`.
- Keep fixture data local when dependency integration is outside the test's scope. Preserve required build and
  test dependencies. Nx also derives project edges from `devDependencies`.

## Code and Tests

- Use TypeScript ES modules, kebab-case package directories and `@8f4e/<package>` imports across workspace packages.
- Use Biome for formatting, linting and import organization (`npx biome check --write <files>`).
- Express repository-owned API contracts with types and JSDoc. Trust callers to satisfy those contracts.
- Use Vitest via Nx. Keep unit tests in `__tests__/` or colocated `*.test.ts` and `*.spec.ts` files unless local
  guidance specifies another location. Use shared helpers from `@8f4e/config/vitest`. Glugglugglug is a separate
  submodule with its own configuration.
- Test coverage is on demand only. Use `npx nx test <project> --coverage --skip-nx-cache` when explicitly requested;
  keep reports in package-local `coverage/` using the shared Vitest defaults. Do not enable coverage in routine
  tests, CI, or releases, cache its artifacts with Nx, or maintain historical test coverage logs.
- Track screenshot baselines. Vitest failure artifacts go in ignored `.vitest-attachments/`.

## Commits, Pull Requests and Releases

- Use Conventional Commits. `fix` triggers a patch, `feat` a minor, and a breaking change a major. Use `fix`
  for maintenance that should ship, `chore` for non-release maintenance and `docs` for documentation-only changes.
  Reserve `chore(release)` for generated commits. Nx also bumps affected dependents.
- Include rationale and test notes in PRs, link related issues, and include screenshots or GIFs for editor UI changes.
  Follow the [review validation workflow](docs/agent_skills/validate-review-comments.md) before acting on comments.
- Update documentation when behavior or APIs change. Follow the
  [document insertion workflow](docs/agent_skills/context-aware-document-inserts.md) when inserting prose.
- Production website deployments run only in the manually dispatched Release workflow on `main` after checks,
  builds and the atomic release push. Keep automatic Cloudflare Git deployments disabled.
  See [release instructions](docs/releasing.md).
- Native Linux checks and releases use their dedicated workflows. Keep the runtime and runtime-command tool out of
  web workflows and web Nx releases.

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
