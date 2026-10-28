# Program Compiler Feature

The compiler effect converts the editor's recursive code-block tree into a `ProjectObjectModel`, invokes
`compileCode(project, options)`, and publishes compiler metadata, diagnostics, and statistics for editor consumers.
The compiler service returns memory and bytecode; core updates its own memory views and renderer artifacts.

## Compilation contract

The callback is asynchronous and returns `CompilationResult`: `memoryRef`, `codeBuffer`, compiled module/function
lookups, the memory plan and defaults, project memory exposures, required/allocated memory bytes, AST cache statistics,
and `memoryAction`. Bytecode size is derived from `codeBuffer.byteLength`.

The effect supplies:

```typescript
{
  startingMemoryAllocationUnitAddress: 0,
  includeStackAnalysis: true,
  enableAssertions: hasTestEntry(project),
}
```

Assertions are enabled for an enabled `test` entry, including nested test modules or a root function exported as
`test`. The compiler integration supplies inert assertion imports for ordinary execution. The selected test runtime
executes tests and publishes their outcomes separately.

Include loading is configured directly on the compiler service. Runtime environment constants arrive as source through
`envConstantContributions`; the generic env-block renderer treats every contributor uniformly.

## Recompilation

`state.compilerInputRevision` advances after source edits, block creation/deletion/paste, execution or disabled-state
toggles, regenerated environment constants, saved control defaults, memory connection removal, and project loading.
Group operations and multi-block paste advance it once after updating their inputs. The revision is monotonic across
project loads and is not stored in project files.

Selection, caret movement, block/project navigation, dragging, favorites, and visual grouping metadata do not advance
the revision. Call `incrementCompilerInputRevision(store)` after updating compiler inputs and their derived state.
`selectedCodeBlockForProgrammaticEdit` refreshes programmatic edits independently of compilation scheduling.

The effect observes the revision and debounces compilation for 500ms by default. Projects can override the delay with
`; @config recompileDebounceDelay <ms>`. Disposal cancels pending work and ignores late results.

## Published state

- `state.compiler.isCompiling` indicates compilation activity.
- `state.compiler.compiledModules` and `compiledFunctions` provide compiler lookups.
- `state.compiler.memoryPlan`, `memoryDefaultsByModuleId`, and `projectMemoryExposuresByGroupPath` support memory consumers.
- `state.info.compiler` contains compilation duration, bytecode size, memory usage, and cache statistics.
- `state.codeErrors.compilationErrors` contains diagnostics mapped to project blocks and source lines.

`memoryAction` distinguishes recreated and reused memory. The binary-assets plugin observes new memory plans and
reloads its retained bytes into current targets. The compiler effect stores no binary asset metadata.
