---
title: 'TODO: Migrate Project Testing to Native Assertions'
priority: Medium
effort: 2-4d
created: 2026-10-09
issue: https://github.com/8f4e/8f4e/issues/1023
status: Open
completed: null
---

# TODO: Migrate Project Testing to Native Assertions

## Problem Description

Compiler fixtures and the CLI already share assertion execution through `@8f4e/test-runner`, but the runner rewrites
`call assert` sources with its nested `@8f4e/test-precompiler` and injects host function declarations. Native compiler
assertions will make this transformation unnecessary and provide source-site metadata for included code as well.

The editor also needs a test runtime that can enable assertion compilation before its runtime factory starts. Its
runtime registry currently cannot contribute compiler options, and the compiler worker instantiates programs with
only memory imports.

After [TODO 490: Add native compiler assertions](archived/490-add-native-compiler-assertions.md) is complete, migrate project
testing to that compiler API and integrate shared execution into the editor. This concerns assertions in 8f4e programs;
package unit tests continue using Vitest.

## Proposed Solution

### Consume the compiler assertion contract

Compile test projects with `enableAssertions: true`. Supply callbacks matching the compiler-owned import contract
and consume its source-site lookup instead of rewriting sources or assigning site IDs in the runner. Native `assert`
uses a zero/nonzero integer condition; `assertEqual expected` consumes one actual stack value and requires an inline
expected argument. It uses exact equality for matching types and compares pointers by address. Callbacks must
implement those agreed semantics rather than retain an implicit tolerance.

The compiler lookup identifies static sites by block ID, group path, module/function identity, instruction kind,
physical block line, and included-source provenance. Runtime invocations report site IDs; loops share a static ID
while each invocation receives its own execution index.

### Shared execution

Keep `@8f4e/test-runner` as the common owner of callback creation, test execution, result collection, and failure
formatting. Accept compiler output directly; callers compile projects and retain their compilation metadata.
Remove source instrumentation and synthetic assertion declarations, then remove the nested `@8f4e/test-precompiler` package and its dependency/build configuration.

Compiler fixture and CLI adapters retain their existing responsibilities for includes, memory options, snapshots,
file selection, and presentation. Both compile with assertions enabled and use the same execution implementation.

The runner owns memory initialization/reset policy and when tests run. This plan does not mandate fresh memory for
each run or automatic execution after compilation; those are separate runner/runtime choices.

### Editor test runtime

Add a selectable `TestRuntime` through the runtime registry. Introduce a small, optional runtime contribution for
compiler options so selecting this runtime enables assertions before compilation. This contribution must be available
before the runtime factory executes, including with lazy runtime loading. Changing runtimes must recompile when the
effective compiler options change.

The compiler worker's initialization instance needs matching assertion imports; empty callbacks are sufficient for
that instance. The test execution instance supplies the runner's real callbacks. Audit other editor instantiation
paths, including environment-plugin export instances, so enabled imports are always satisfied. Worker messages carry
serializable options and results rather than callback functions.

Resolve memory ownership explicitly. The current runner allocates non-shared memory, whereas editor runtimes receive
memory from the compiler worker. Allow execution with compatible supplied memory and keep initialization and reset
policy in the runner/runtime, independent of assertion emission. Document ownership so the compiler worker and test
runner do not accidentally initialize the same memory twice.

Publish results tagged with a compilation/run identity and ignore results from superseded runs. Retain all static sites
and execution results so later editor indicators can show red if any invocation fails, green if executed invocations
all pass, and neutral if a site was never executed. Rendering green/red icons is a follow-up UI task.

## Current migration scope

The current PR migrates only the existing compiler fixture and CLI tests. Editor runtime integration and the test
gallery are excluded. The editor plan above remains deferred to a separate follow-up; this TODO stays open for that
remaining work.

## Implementation Plan

1. Refactor the shared runner to accept compiled artifacts, consume source sites, and supply assertion callbacks.
   Keep compilation in the adapters, with explicit memory and initialization ownership.
2. Migrate compiler fixtures and `8f4e test` to native instructions. Existing two-value `call assert` comparisons become
   `assertEqual`, preserving operand-producing code and physical source lines where practical. Review fixtures that
   previously relied on tolerance and express approximate expectations explicitly. Update snapshots.
3. Remove the precompiler package, injected declarations, workspace references, and obsolete documentation.
4. Add the runtime compiler-options contribution and editor `TestRuntime`, update initialization imports, and propagate
   compiler site metadata and run results across the worker boundary. Handle runtime changes, disposal, and stale runs.
5. Update runner, CLI, and runtime documentation with the new contracts and migration examples.

## Success Criteria

- [x] Runner callbacks implement the documented integer-condition and exact-equality semantics.
- [x] Failure reports use compiler-produced source sites, including nested groups and included code.
- [x] A failed assertion does not prevent subsequent assertions from running through the default collecting callbacks.
- [x] Loops preserve static site identity while results record each invocation; unexecuted sites remain distinguishable.
- [ ] Compiler fixtures, CLI tests, and the editor runtime share callback creation, execution, and reporting.
- [x] The precompiler package and synthetic assertion declarations are removed.
- [ ] Editor runtime selection controls compilation, initialization instances satisfy imports, and stale results are ignored.
- [ ] Memory ownership and reset behavior are documented and covered for CLI and editor execution.
- [x] Approximate fixture expectations are explicit rather than hidden in `assertEqual` callbacks.
- [ ] Runner, CLI, and runtime documentation describes the migrated contracts.

## Validation Checkpoints

- Run Nx tests/typechecks/builds for `@8f4e/test-runner`, `@8f4e/cli`, and affected compiler/editor packages.
- Run compiler fixture and example/CLI suites after migrating syntax and review intentional snapshot changes.
- Run editor runtime/state/default-composition tests and typechecks, then build the editor/product websites.
- Exercise test-runtime selection, recompilation, deferred runtime loading, initialization, repeated runs, disposal,
  and stale worker results with focused integration coverage.
- Cover truth assertions, equality, NaN, infinities, failure continuation, branches, and repeated loop invocations
  through the shared runner. Verify unexecuted sites remain distinguishable from passed sites.
- Verify migrated source-site lines for comments and continued source lines, including nested/included sources.

## Affected Components

- `packages/test-runner/` - Shared execution API, callbacks, reporting, and removal of its nested precompiler.
- `packages/cli/src/test/` - Native assertion compilation and runner adapter.
- `packages/editor/packages/editor-core/` - Runtime option contribution and assertion result state contracts.
- `packages/editor/packages/editor-default/` - Runtime registration, lazy loading, and compiler service integration.
- `packages/editor/packages/compiler-worker/` - Initialization imports and source-site metadata transport.
- A new editor test-runtime package, existing instantiation paths, and project/language documentation.
- Compiler fixture sources and runner integration tests under `packages/compiler/tests/`.

## Risks & Considerations

- **Exact equality changes existing behavior:** the current runner uses a tolerance of `0.001` and fails NaN comparisons.
  Native `assertEqual` removes that tolerance. Review affected fixture expectations and express approximate comparisons
  explicitly rather than silently retaining the old policy in callbacks.
- **Migration compatibility:** coordinate project assertion syntax, runner APIs, package references, and snapshots
  before removing instrumentation. This TODO removes the precompiler path after consumers use native instructions.
- **Required imports:** every enabled-program instantiation path must provide matching assertion callbacks, including
  editor initialization and environment-plugin export instances. Worker messages cannot carry callback functions.
- **Memory and execution policy:** runner/runtime code owns memory initialization/reset and test scheduling. Support
  compatible supplied memory and avoid duplicate initialization without imposing these policies on compiler assertions.
- **Stale results:** compiler site IDs are scoped to a compiled program. Tag runs with compilation identity and discard
  results from superseded runs, especially after edits, runtime changes, or disposal.

## Related Items

- **Depends on:** [TODO 490: Add native compiler assertions](archived/490-add-native-compiler-assertions.md).
- [TODO 455: Unify assert and assertf with polymorphic overloads](archived/455-unify-assert-and-assertf-with-polymorphic-overloads.md).
- [TODO 438: Add generic function imports](archived/438-add-generic-function-imports.md).
- [TODO 437: Add execution entries](archived/437-add-execution-groups.md).

## References

- [Shared runner and current contract](../../packages/test-runner/README.md).
- [Runtime registry types](../../packages/editor/packages/editor-core/packages/editor-state-types/src/features/runtime/types.ts).
- [Current shared-runner PR](https://github.com/8f4e/8f4e/pull/1002).

## Notes

Recorded on 2026-10-09. Compiler assertion support is an independent prerequisite in TODO 490. Memory/reset behavior
and when tests run are runner/runtime choices; this plan mandates neither fresh memory per run nor automatic runs
after compilation. Rendering green/red assertion icons remains a follow-up UI task.

The compiler fixture and CLI adapters compile original project sources with native assertions enabled, then pass
the compiled output to the shared runner. Assertion imports
and source sites come from the compiler, and the precompiler package has been removed. Fresh CLI/fixture memory is
initialized once. Approximate expectations in four fixture files now express a `0.001` absolute error bound in source; other
comparisons use exact `assertEqual expected`, which consumes one actual stack value and requires the expected value
inline. The fixture and CLI sources use this syntax directly. Editor execution and gallery behavior are deferred.

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update `docs/todos/_index.md`.
