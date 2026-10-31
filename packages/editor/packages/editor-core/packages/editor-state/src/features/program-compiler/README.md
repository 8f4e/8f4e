# Compilation Inputs and Published State

Editor state tracks compilation inputs and exposes compiler metadata for editor features. Actual compilation belongs
to `@8f4e/editor-plugin-compiler`, which owns scheduling, its worker, include resolution, diagnostics, and statistics.
Core has no compilation callback or built-in compilation effect.

## Input changes

`state.compilerInputRevision` advances after source edits, block creation/deletion/paste, execution or disabled-state
toggles, regenerated environment constants, saved control defaults, memory connection removal, and project loading.
Group operations and multi-block paste advance it once after updating their inputs. The revision is monotonic across
project loads and is not stored in project files.

Selection, caret movement, block/project navigation, dragging, favorites, and visual grouping metadata do not advance
the revision. Call `incrementCompilerInputRevision(store)` after updating compiler inputs and their derived state.
`selectedCodeBlockForProgrammaticEdit` refreshes programmatic edits independently of compilation scheduling.

Core's input-change publisher observes the revision and emits `compilationInputChanged`. A compiler plugin can listen
without understanding individual editing actions. The standard compiler plugin debounces those events, serializes the
latest code-block tree, and ignores obsolete responses. Its `recompileDebounceDelay` setting is available only when the
plugin is installed.

## Published state and artifacts

- `state.compiler.isCompiling` indicates compilation activity.
- `state.compiler.compiledModules` and `compiledFunctions` provide compiler lookups.
- `state.compiler.memoryPlan`, `memoryDefaultsByModuleId`, and `projectMemoryExposuresByGroupPath` support memory consumers.
- `state.info.compiler` contains compilation duration, bytecode size, memory usage, and cache statistics.
- `state.codeErrors.compilationErrors` contains diagnostics mapped to project blocks and source lines.

The plugin updates its live artifact handles and emits `compilationSucceeded` with `ProgramArtifacts` (`memoryRef`)
before publishing metadata and runtime readiness. Core consumes that event to refresh memory views; bytecode stays
on the compiler getter. All compiler metadata is published atomically in one `state.compiler` replacement while
`isCompiling` remains true. After metadata subscribers finish, `compiler.isCompiling` becomes false to resume runtimes.
`memoryAction` distinguishes recreated and reused memory. The binary-assets plugin observes new memory plans and
reloads its retained bytes into current targets before runtimes resume. Editor state stores no binary asset metadata.

Runtime environment constants arrive as source through `envConstantContributions`; the generic env-block renderer
treats every contributor uniformly. Runtime plugins receive compiler artifact getters through their factories.
