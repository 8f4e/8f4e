# Production Build Input Audit

Audit for [issue #1348](https://github.com/8f4e/8f4e/issues/1348), performed on 2026-11-01 against all 77 Nx projects, including the renderer submodule and release tooling.

## Scope and method

Reviewed workspace imports, fixture references, package manifests, implicit dependencies, every target's commands and prerequisites, TypeScript build inclusion, Vite source collections, and resolved named inputs. The repeatable check uses the workspace's pinned Nx hash planner, rather than interpreting the input globs independently. It checks every `build`, `build-deps`, `generate-content`, `generate-fonts`, and `typecheck:production` target and their prerequisite graphs.

Run the check after dependency or input changes:

```sh
npx nx run @8f4e/release:audit-build-inputs
# Include a fresh inventory of references used only by tests or fixtures:
npx nx run @8f4e/release:audit-build-inputs --output-style=static -- --inventory
```

CI and `@8f4e/release:check` run the check. The script uses Nx's internal `HashPlanInspector` and file map because they expose the actual resolved files and tasks. Recheck these APIs when upgrading Nx. The reference inventory is an audit aid: it scans tracked source/config text for workspace names, including raw imports and package resolution strings, and needs human review of non-import matches and target commands.

## Confirmed cases and corrections

| Case | Affected targets and consumers | Correction |
| --- | --- | --- |
| `default` / `^default` hash test code, fixtures, snapshots, screenshot baselines and test configuration | Every production build and its transitive consumers | Builds use `production` / `^production`. Known test paths are excluded; all other source, docs, configuration and assets remain included. Tests retain their own `default`; tests and type checks consume dependency `production` inputs. |
| Sprite palette tests and screenshot previews import example programs and modules | `sprite-generator:build`, `editor-core`, `editor-minimal`, `editor-default`, WebMCP and both websites; the sprite prerequisite graph included CLI and compiler builds through `examples` | Replace the cross-package example sources with local fixtures containing only the 12 palettes' color directives. Remove `@8f4e/examples` from the sprite manifest and lockfile. Keep palette implementation imports and all assertions/screenshots. The sprite build task graph falls from 23 tasks to 5; editor-minimal from 62 to 60. |
| `generate-fonts` had broad implicit inputs; WebMCP `generate-content` explicitly used `default` / `^default` | Font generation under editor builds; catalog generation under website builds | Font generation uses its own production inputs; content generation uses production inputs and dependency production inputs. Compiler/editor docs and bundled examples remain catalog inputs. |
| Product website build runs a type check including browser tests | `8f4e-website:build` and its build prerequisites | Add `typecheck:production` and `tsconfig.production.json`; retain the existing full `typecheck` for CI/test checks. |
| Render-projection's `src/syntax-highlighting/testUtils.ts` is only a test helper outside recognized test directories | Render-projection and all editor consumers | Move it under `__tests__`, update test imports and the declaration build's exclusion. |
| Compiler `tests/**/*.test.8f4e` are also shipped gallery assets | Compiler tests, product website build and the `/tests/` page | Exclude them from the compiler's production input, explicitly include the shipped fixtures in the product website's inputs. Keep the website's `src/tests/` page as production source. Error fixtures, test hosts and snapshots remain test-only. |
| Metrics dashboard has an explicit build-input override | Metrics dashboard production build | Switch the project/dependency portions to production inputs and preserve every external metrics/log input. |

A smaller task graph is not the sole success criterion. The product website still schedules legitimate example/catalog builds. A save must stop changing unrelated editor build hashes, even when those targets are visited and restored from cache.

## Preserved production relationships

- Default editor source collections consume stdlib `.8f4e` files and bundled example `.8f4em` modules. The minimal editor consumes stdlib sources. Their package/build relationships remain intact.
- The product gallery consumes example project sources and its preview images. WebMCP consumes example modules, example projects, and compiler/editor Markdown; generator imports of the compiler, example-module helpers and source-discovery plugin are production tooling, even when declared as dev dependencies.
- Compiler workers, audio worklets, worker runtimes and their emitted assets remain production prerequisites. The audit checks representative source inclusion and prerequisite tasks for each.
- `@8f4e/config` ships shared TypeScript, Vite and Vitest helpers. Its `src/vitest/` code is a real package output and remains included.
- The source-only stdlib project has no build target, but its files still propagate through dependency inputs. No general exclusion of `.8f4e`, `.8f4em`, `.bin`, images or Markdown was introduced.
- The embedded test runtime is a shipped optional editor feature. Its implementation remains production code.

## Test execution versus test dependencies

No `build`, `build-deps`, font-generation or catalog-generation prerequisite graph schedules a test target. The dev servers' `watch-deps → build-deps → ^build` chains build packages; they do not execute tests. The original repeated reloads came from dependency and input propagation plus rebuilding outputs, not from test execution.

`@8f4e/release:check` intentionally runs tests alongside builds and metrics. `examples:test → cli:test` is also intentional. These verification paths remain unchanged.

## Remaining dependency boundaries

Excluding test files from production hashes does not remove project graph edges inferred from test imports or manifests. A production implementation change in a test-only dependency can still invalidate a consumer build through `^production`. The inventory below records every confirmed source-reference case from this audit; each row affects the named consumer's build/typecheck prerequisites and its reverse production dependency closure.

The chosen follow-up for these implementation dependencies is to isolate test harnesses into their own Nx projects, or add carefully scoped target-specific prerequisites and inputs while preserving affected-test selection. Do not replace the implementation under test with a copied implementation, or hide required imports using negative implicit dependencies. Moving a dependency to `devDependencies` alone does not remove its Nx graph edge.

| Boundary group | Downstream production consumers | Follow-up |
| --- | --- | --- |
| Compiler stages, compiler test runner and stdlib resolver | Compiler, CLI, examples, compiler-worker, editor compositions, WebMCP and both websites | Separate the compiler fixture/test harness from stage builds; keep real tokenizer/parser/compiler API tests. |
| Editor state/core/rendering testing helpers | Core, rendering libraries, editor plugins, both editor compositions, WebMCP and websites | Give shared test harnesses their own target boundary; keep built implementation exports for integration tests. |
| Editor plugin unit/browser harnesses and composition integration tests | Owning plugin/composition, default/minimal editors where composed, WebMCP and corresponding websites | Move real-editor browser harness dependencies out of production graph paths; prefer small local fixture data where only sample input is needed. |
| WebMCP real-editor browser harness | WebMCP and both websites | Isolate `editor-default`, editor-state and editor-state-testing test consumers while retaining compiler/example-module/source-plugin catalog-generation dependencies. |
| Sprite palette implementation tests | Sprite-generator, core and editor consumers | Palette resolution is an implementation dependency, unlike the now-local example fixture data. Isolate the rendering test harness if further production dependency pruning is needed. |

| Consumer | Test-only references (first evidence file) |
| --- | --- |
| `@8f4e/8f4e-website` | `@8f4e/editor-core` (src/lazy-plugins.test.ts) |
| `@8f4e/compiler` | `@8f4e/stdlib` (tests/stdlibResolver.ts); `@8f4e/test-runner` (tests/testRunner.test.ts) |
| `@8f4e/editor-core` | `@8f4e/editor-state-testing` (src/events/keyboardEvents.test.ts) |
| `@8f4e/editor-default` | `@8f4e/editor-state` (src/lazy-plugins.integration.test.ts); `@8f4e/web-ui` (src/lazy-plugins.integration.test.ts); `@8f4e/compiler` (src/lazy-plugins.integration.test.ts) |
| `@8f4e/editor-minimal` | `@8f4e/compiler` (src/stdlib-resolver.test.ts) |
| `@8f4e/editor-plugin-assertion-markers` | `@8f4e/test-runner` (screenshot-tests/assertion-markers.test.ts); `@8f4e/compiler` (screenshot-tests/assertion-markers.test.ts); `@8f4e/editor-state-testing` (src/deriveAssertionMarkers.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-audio-runtime` | `@8f4e/editor-state` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts); `@8f4e/compiler` (src/index.test.ts) |
| `@8f4e/editor-plugin-bars` | `@8f4e/web-ui-render-projection` (screenshot-tests/bars.test.ts); `@8f4e/sprite-generator` (screenshot-tests/bars.test.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-binary-assets` | `@8f4e/compiler` (screenshot-tests/binary-assets.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-button` | `@8f4e/web-ui-render-projection` (screenshot-tests/button.test.ts); `@8f4e/sprite-generator` (screenshot-tests/button.test.ts); `@8f4e/compiler` (screenshot-tests/button.test.ts); `@8f4e/editor-state-testing` (src/drawer/drawButton.test.ts) |
| `@8f4e/editor-plugin-compiler` | `@8f4e/editor-state-testing` (src/compilation.test.ts); `@8f4e/state-manager` (src/compilation.test.ts) |
| `@8f4e/editor-plugin-connectors` | `@8f4e/sprite-generator` (screenshot-tests/connectors.test.ts); `glugglugglug` (screenshot-tests/connectors.test.ts); `@8f4e/editor-state-testing` (screenshot-tests/connectors.test.ts); `@8f4e/compiler` (screenshot-tests/editor.test.ts) |
| `@8f4e/editor-plugin-crossfade` | `@8f4e/web-ui-render-projection` (screenshot-tests/crossfade.test.ts); `@8f4e/sprite-generator` (screenshot-tests/crossfade.test.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-example-modules` | `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-favorites` | `@8f4e/compiler` (screenshot-tests/favorites.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-grouping` | `@8f4e/compiler` (screenshot-tests/grouping.test.ts); `@8f4e/web-ui` (src/__tests__/editor.ts) |
| `@8f4e/editor-plugin-keyboard-memory` | `@8f4e/editor-state-testing` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts); `@8f4e/compiler` (src/index.test.ts) |
| `@8f4e/editor-plugin-lazy-loader` | `@8f4e/editor-plugin-plot` (screenshot-tests/loading.test.ts); `@8f4e/compiler` (screenshot-tests/loading.test.ts); `@8f4e/editor-state-types` (src/__tests__/editor.ts); `@8f4e/web-ui` (src/__tests__/editor.ts) |
| `@8f4e/editor-plugin-meter` | `@8f4e/web-ui-render-projection` (screenshot-tests/meter.test.ts); `@8f4e/sprite-generator` (screenshot-tests/meter.test.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-midi-input` | `@8f4e/editor-state-testing` (src/config.test.ts); `@8f4e/state-manager` (src/devices.test.ts); `@8f4e/editor-state` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts); `@8f4e/compiler` (src/index.test.ts) |
| `@8f4e/editor-plugin-piano` | `@8f4e/web-ui-render-projection` (screenshot-tests/piano.test.ts); `@8f4e/sprite-generator` (screenshot-tests/piano.test.ts); `@8f4e/compiler` (screenshot-tests/piano.test.ts); `@8f4e/editor-state-testing` (src/helpers/saveDefaults.test.ts) |
| `@8f4e/editor-plugin-plot` | `@8f4e/web-ui-render-projection` (screenshot-tests/plot.test.ts); `@8f4e/sprite-generator` (screenshot-tests/plot.test.ts); `@8f4e/language-spec` (src/__tests__/memory.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-project-open` | `@8f4e/editor-plugin-project-save` (screenshot-tests/project-open.test.ts); `@8f4e/editor-state-testing` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-project-save` | `@8f4e/compiler` (src/serializeTo8f4e.test.ts) |
| `@8f4e/editor-plugin-project-url-loader` | `@8f4e/web-ui` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-remove-memory-connections` | `@8f4e/compiler` (screenshot-tests/remove-memory-connections.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-screenshot` | `@8f4e/compiler` (screenshot-tests/screenshot.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-session-persistence` | `@8f4e/compiler` (screenshot-tests/session-persistence.test.ts); `@8f4e/web-ui` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-slider` | `@8f4e/web-ui-render-projection` (screenshot-tests/slider.test.ts); `@8f4e/sprite-generator` (screenshot-tests/slider.test.ts); `@8f4e/compiler` (screenshot-tests/slider.test.ts); `@8f4e/editor-state-testing` (src/drawer/draw.test.ts) |
| `@8f4e/editor-plugin-stack` | `@8f4e/web-ui-render-projection` (screenshot-tests/stack.test.ts); `@8f4e/sprite-generator` (screenshot-tests/stack.test.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-switch` | `@8f4e/web-ui-render-projection` (screenshot-tests/switch.test.ts); `@8f4e/sprite-generator` (screenshot-tests/switch.test.ts); `@8f4e/web-ui` (screenshot-tests/switch.test.ts); `@8f4e/compiler` (screenshot-tests/switch.test.ts) |
| `@8f4e/editor-plugin-test-runtime` | `@8f4e/editor-state-testing` (src/runtime.test.ts); `@8f4e/state-manager` (src/runtime.test.ts); `@8f4e/compiler` (src/runtime.test.ts) |
| `@8f4e/editor-plugin-texture-runtime` | `@8f4e/editor-plugin-lazy-loader` (screenshot-tests/editor.test.ts); `@8f4e/editor-plugin-compiler` (screenshot-tests/editor.test.ts); `@8f4e/compiler` (screenshot-tests/editor.test.ts); `@8f4e/sprite-generator` (screenshot-tests/formats.test.ts); `glugglugglug` (screenshot-tests/formats.test.ts); `@8f4e/editor-palette` (src/index.test.ts) |
| `@8f4e/editor-plugin-toggle-skip-execution` | `@8f4e/editor-state-testing` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-tooltips` | `@8f4e/web-ui-render-projection` (screenshot-tests/tooltips.test.ts); `@8f4e/sprite-generator` (screenshot-tests/tooltips.test.ts); `@8f4e/compiler` (screenshot-tests/tooltips.test.ts); `@8f4e/editor-state-testing` (src/drawer/draw.test.ts); `@8f4e/state-manager` (src/state/effect.test.ts) |
| `@8f4e/editor-plugin-wasm-export` | `@8f4e/web-ui` (src/index.test.ts) |
| `@8f4e/editor-plugin-watch` | `@8f4e/web-ui-render-projection` (screenshot-tests/watch.test.ts); `@8f4e/sprite-generator` (screenshot-tests/watch.test.ts); `@8f4e/compiler` (src/__tests__/setup.ts) |
| `@8f4e/editor-plugin-wave` | `@8f4e/web-ui-render-projection` (screenshot-tests/wave.test.ts); `@8f4e/sprite-generator` (screenshot-tests/wave.test.ts); `@8f4e/compiler` (screenshot-tests/wave.test.ts); `@8f4e/editor-state-testing` (src/drawer/draw.test.ts) |
| `@8f4e/editor-plugin-worker-runtime` | `@8f4e/editor-state` (src/index.test.ts); `@8f4e/web-ui` (src/index.test.ts); `@8f4e/compiler` (src/index.test.ts) |
| `@8f4e/editor-state` | `@8f4e/compiler` (src/features/code-blocks/layout/layout.test.ts) |
| `@8f4e/editor-webmcp` | `@8f4e/editor-state` (browser-tests/bridge.test.ts); `@8f4e/editor-default` (browser-tests/bridge.test.ts); `@8f4e/editor-state-testing` (src/index.test.ts) |
| `@8f4e/memory-default-resolver` | `@8f4e/memory-planner` (src/index.test.ts) |
| `@8f4e/memory-reference-resolver` | `@8f4e/tokenizer` (src/index.test.ts) |
| `@8f4e/program-composer` | `@8f4e/project-preparser` (tests/composeProgram.integration.test.ts) |
| `@8f4e/runtime-test-runner` | `@8f4e/compiler` (src/executeTests.test.ts) |
| `@8f4e/semantic-reference-resolver` | `@8f4e/tokenizer` (src/referenceResolvers/loop.test.ts) |
| `@8f4e/sprite-generator` | `@8f4e/editor-palette` (screenshot-tests/test-cases/palette-themes.ts) |
| `@8f4e/stack-analyzer` | `@8f4e/tokenizer` (src/instruction-tests/call.test.ts) |
| `@8f4e/test-runner` | `@8f4e/project-preparser` (src/index.test.ts) |
| `@8f4e/wasm-codegen` | `@8f4e/tokenizer` (src/instructionCompilers/castToFloat64.test.ts) |
| `@8f4e/web-ui` | `@8f4e/editor-state-testing` (screenshot-tests/dragged-modules.test.ts) |
| `@8f4e/web-ui-render-projection` | `@8f4e/editor-state-testing` (src/projection.test.ts) |


The other reviewed projects have no workspace-name references confined to tests in the inventory scan: `@8f4e/cli`, `@8f4e/compiler-wasm-utils`, `@8f4e/compiler-worker`, `@8f4e/config`, `@8f4e/constant-resolver`, `@8f4e/editor-file-session`, `@8f4e/editor-palette`, `@8f4e/editor-state-testing`, `@8f4e/editor-state-types`, `@8f4e/editor-website`, `@8f4e/examples`, `@8f4e/language-spec`, `@8f4e/memory-planner`, `@8f4e/metrics-dashboard`, `@8f4e/project-preparser`, `@8f4e/release`, `@8f4e/runtime-audio-worklet`, `@8f4e/runtime-web-worker`, `@8f4e/semantic-utils`, `@8f4e/state-manager`, `@8f4e/stdlib`, `@8f4e/sub-program`, `@8f4e/tokenizer`, `@8f4e/vite-plugin-sources`, `glugglugglug`. Relative filesystem references and manifest-only/tooling relationships were reviewed separately; the cases below cover them. This inventory does not prove every manifest or external dependency is required for production.

### Other confirmed over-invalidation and follow-ups

1. **Examples → CLI is a manifest/tooling relationship.** `examples:build` runs standalone lookup-table generators with no CLI import, but `^build` still schedules CLI/compiler builds because the examples manifest declares CLI. CLI is needed by example tests and metric targets. Follow up by separating the source/generation boundary from CLI verification, with explicit CLI test/metrics inputs and prerequisites. This relationship remains intact here to preserve affected-test behavior.
2. **All external packages are hashed by default.** Nx's resolved build plans include `AllExternalDependencies`, including test tooling. Test-tool version changes can therefore invalidate production caches. Follow up with per-executor/target `externalDependencies` sets covering the actual compiler/bundler, runtime packages and their transitive dependencies; a blanket tool-only allowlist would risk stale builds. Local palette fixtures fix the workspace edge, not this lockfile-level policy.
3. **Broad non-test inputs remain conservative.** Documentation, authoring tools, renderer benchmarks/examples and package metadata are still included unless explicitly identified as test files. Compiler doc edits and stdlib edits still reach core through existing compiler/test relationships. Narrow these with explicit producer/consumer input sets only after recording every shipped consumer, especially WebMCP docs and the test gallery. The default editor also still hashes example project sources although its source collection bundles only modules. Follow up with separate module/project input sets: the default composition needs modules; WebMCP and the product gallery need both. The renderer submodule was audited without changing its pinned revision.
4. **CLI example fixtures already have a test-only input boundary.** `cli:test` explicitly includes the examples project inputs without adding an examples edge to CLI builds. `tests/exampleProjectsCompilation.test.ts`, `tests/exampleProjectsLayout.test.ts`, and the module test-runner CLI test deliberately verify shipped examples. Retain those integration inputs. `tests/compileProjectAudioBuffer.test.ts` is a candidate for a smaller local fixture if its API test is separated from example coverage; it currently creates no production build coupling. The audit checks this boundary.
5. **Necessary rebuilds still replace `dist`.** Missing modules and intermediate Vite reloads during a genuine rebuild require a separate output/watch-lifecycle change. This audit does not change dist cleaning or suppress asset watches.

## Validation

- All workspace builds passed: 79 tasks. A final combined build/typecheck pass passed all 152 tasks.
- All workspace unit-test targets and prerequisites passed: 142 tasks, including embedded example-module tests.
- All four sprite screenshot comparisons passed against the existing Git LFS baselines; no screenshot updates were needed.
- The production-input audit checks all 77 projects and 80 production targets, including development build prerequisites. No resolved production input contains a recognized test-only file except the explicitly shipped test-gallery content, and no production prerequisite graph executes tests.
- Controlled file edits were applied one at a time, hashed in fresh Nx processes, and restored byte-for-byte. All hashes returned to the original baseline after restoration. The table lists changes among 12 sampled build/test/generator targets.

| Edited input | Observed hash changes |
| --- | --- |
| Local palette fixture | Sprite unit and screenshot tests only; sprite/font/core/minimal/default/catalog/website builds unchanged |
| Example project or bundled module | Default editor, WebMCP build/catalog and product website; sprite and minimal editor builds unchanged |
| Sprite production source | Sprite build/tests/font generation and every sampled editor/catalog/website consumer |
| Shipped compiler `.test.8f4e` fixture | Compiler tests and product website only; compiler and editor builds unchanged |
| Stdlib source | Both editor compositions and website/catalog consumers remain invalidated; existing compiler test-only graph paths also remain, as recorded above |
| Compiler documentation | WebMCP catalog and website consumers remain invalidated; conservative compiler/core propagation also remains, as recorded above |

The permanent check repeats the resolved-input and task-graph assertions without editing files. After adding a new shipped asset location or a new test convention, update its explicit expectations alongside the relevant named input.
