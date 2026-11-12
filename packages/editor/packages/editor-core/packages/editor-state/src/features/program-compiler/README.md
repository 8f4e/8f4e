# Compilation Inputs and Published State

Editor state tracks compilation inputs and exposes compiler metadata for editor features. Actual compilation belongs
to `@8f4e/editor-plugin-compiler`, which owns scheduling, its worker, include resolution, diagnostics, and statistics.
Core has no compilation callback or built-in compilation effect.

## Input changes

`state.compilerInputRevision` advances after source edits, block creation/deletion/paste, execution or disabled-state
toggles, regenerated environment constants, saved control defaults, memory connection removal, and project loading.
Dragging advances it once on drop when the canonical left-to-right, top-to-bottom order of non-note blocks changes,
including constants precedence and execution order inside nested project groups. It also advances when a drop changes
resolved compiler configuration, including when moving a note changes which config directive wins.
Group operations and multi-block paste advance it once after updating their inputs. The revision is monotonic across
project loads and is not stored in project files.

Selection, caret movement, navigation, favorites, and layout changes that preserve compiler inputs leave the revision
unchanged. Call `incrementCompilerInputRevision(store)` after updating compiler inputs and their derived state.

Config schema contributions can set `affectsCompilation: true` to mark their resolved root as a compiler input.
`applyCodeBlockSourceEdits` emits `codeBlockSourcesChanged { codeBlocks }` to refresh source-derived state and directive
diagnostics, then advances the revision once if either the source edit or a marked config root changed compiler inputs.

Core's input-change publisher observes the revision and emits `compilationInputChanged`. A compiler plugin can listen
without understanding individual editing actions. The standard compiler plugin debounces those events, serializes the
latest code-block tree, and ignores obsolete responses. Its `recompileDebounceDelay` setting is available only when the
plugin is installed.

## Published state and artifacts

- `state.compiler.isCompiling` indicates compilation activity independently of the last accepted `state.compiler.result`.
- `state.compiler.result.inputRevision` identifies the inputs of the last successful result, or is null before success.
  Source-line consumers compare it with `state.compilerInputRevision` to suppress outdated positions while edits compile.
- `state.compiler.result.compiledModules` and `compiledFunctions` provide compiler lookups.
- `state.compiler.result.memoryPlan`, `memoryDefaultsByModuleId`, and `projectMemoryExposuresByGroupPath` support memory consumers.
- `state.info.compiler` contains compilation duration, bytecode size, memory usage, and cache statistics.
- `state.codeErrors.compiler` contains diagnostics mapped to project blocks and source lines.

Source-specific views use `getCompiledModuleForCodeBlock` to match the selected definition's `projectBlockId` to the
editor block's `creationIndex`. `getModuleCompilationForCodeBlock` resolves that module, its memory plan, and its defaults
together, returning no result until all reports are available. Overridden source blocks receive no module artifacts.
The connectors plugin owns inherited declaration ordering, shape/paramShape labels, and connector presentation.

`getCurrentCompiledLineForCodeBlock(block, state, sourceLineNumber = block.cursor.row)` supplies current parsed
source and stack-analysis metadata to line-based views. It checks the accepted input revision and source owner,
then looks up the requested compiler line number directly. Compiler line numbers remain authoritative;
source-edit invalidation determines when compilation must refresh them. Views retain source-only documentation
while a new compilation is pending. Stack-producers and tooltips share this accessor.

The plugin updates its live artifact handles and emits `compilationSucceeded` with `ProgramArtifacts` (`memoryRef`)
before publishing metadata and runtime readiness. Core consumes that event to refresh memory views; bytecode stays
on the compiler getter. The input revision and all compiler metadata are published atomically
in one `state.compiler.result` replacement while `isCompiling` remains true. After metadata subscribers finish, `compiler.isCompiling` becomes false to resume runtimes.
`memoryAction` distinguishes recreated and reused memory. The binary-assets plugin observes new memory plans and
reloads its retained bytes into current targets before runtimes resume. Editor state stores no binary asset metadata.

Runtime environment constants arrive as source through `envConstantContributions`; the generic env-block renderer
treats every contributor uniformly. Runtime plugins receive compiler artifact getters through their factories.
