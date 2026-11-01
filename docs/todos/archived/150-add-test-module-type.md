---
title: 'TODO: Add #test directive and assert runner'
priority: Medium
effort: 2-4d
created: 2025-12-28
issue: https://github.com/8f4e/8f4e/issues/547
status: Completed
completed: 2026-05-29
---

# TODO: Add #test directive and assert runner

## Problem Description

8f4e has no first-class way to write executable language-level tests inside a project. Compiler and instruction behavior is currently validated mostly through TypeScript test harnesses and ad-hoc WebAssembly execution tests, but users cannot express examples like "call this 8f4e function with these values and assert the result" as part of the 8f4e source itself.

The design should support testing functions that take memory addresses as parameters. Tests therefore need normal module behavior: memory declarations, address references, stack instructions, function calls, and compiler-owned internal resources.

## Proposed Solution

Add a module compiler directive named `#test` and an `assert` instruction.

`#test` marks an ordinary module as a test module:

```8f4e
module addWorks
#test
push 1
push 2
call add
assert 3
moduleEnd
```

The directive is intentionally a module classification flag, not a new block type. A `#test` module should behave like any other module for parsing, namespace layout, memory declarations, address references, stack validation, hidden internal resource allocation, and code generation. The compiler only needs the flag when deciding which module functions are called by the normal `cycle` export and which are called by the test runner export.

`assert <expected-int>` compares the top stack value against the expected integer. On mismatch it calls an imported host function, then continues executing. If no failure import is called during `runTests`, all tests passed.

Use a small import ABI:

```ts
test.assertFailed(assertIndex: number, expected: number, received: number): void
```

The import does not need to throw. The host runner can collect failures and report them after `runTests()` returns.

The compiler should expose assertion metadata that maps `assertIndex` to source context:

```ts
{
  assertIndex: 0,
  moduleId: 'addWorks',
  lineNumber: 6,
  expected: 3,
}
```

## Design Decisions

- Use `#test` instead of `test` / `testEnd`; test modules are literally modules with a directive.
- Keep `assert` valid in any module for now. Production builds still need to provide the import if production code can execute an assertion.
- Support integer assertions only in v1. Float assertions and approximate comparisons are out of scope.
- Do not allocate memory slots for assertion results in v1. Assertion failures are reported through the imported host function.
- Do not track whether assertions were executed in v1.
- Do not add single-test dispatch in v1. `runTests` runs all test modules.
- Do not reset memory between tests. Test isolation comes from module-style memory layout: every test module has its own namespace and memory declarations, just like ordinary modules.

## Implementation Plan

### Step 1: Add directive and metadata plumbing

- Add `#test` to module compiler directives.
- Preserve the existing directive prologue rule: `#test` must appear in the module prologue.
- Add module AST / compiled module metadata such as `testExecution?: true`.
- Ensure normal module namespace layout and hidden internal resource allocation are reused unchanged.

### Step 2: Add `assert` instruction

- Add `assert` to instruction specs with one integer compile-time expected value argument.
- Require one integer stack operand.
- Emit WebAssembly that compares the received stack value to the expected value.
- On mismatch, call the imported `test.assertFailed(assertIndex, expected, received)` function.
- Ensure `assert` consumes the received value so module stack validation still requires an empty stack at `moduleEnd`.

### Step 3: Add test runner build path

- Extend the compiler output for test-capable builds with a `runTests` export.
- Generate `runTests` by calling every compiled module marked with `#test`, in the same source/layout order used for modules.
- Exclude `#test` modules from the normal `cycle` dispatcher.
- Decide whether normal builds omit `runTests` entirely or include it only when test modules exist.

### Step 4: Expose assertion metadata

- Allocate stable `assertIndex` values during compilation.
- Return metadata from the compiler result so editor/CLI runners can map failure callbacks to module ids and source line numbers.
- Keep expected values in metadata as well as in emitted code for reporting consistency.

### Step 5: Wire host runners

- Update the compiler worker, CLI, or any runtime path that executes tests to provide the `test.assertFailed` import.
- Collect failure callbacks in JS/TypeScript.
- Report all failures after `runTests()` returns.

### Step 6: Document syntax and behavior

- Document `#test`, `assert`, `runTests`, and the host import ABI.
- Mention v1 limitations: integer-only assertions, no execution tracking, no per-test dispatch, no memory reset between tests.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test`.
- `npx nx run-many --target=typecheck --all`.
- Add public compiler tests that instantiate a test build, call `runTests`, and verify failed assertions call the import with `assertIndex`, `expected`, and `received`.
- Add tests proving `#test` modules are excluded from `cycle` and included in `runTests`.
- Add tests proving memory declarations and pointer arguments work inside `#test` modules.

## Success Criteria

- [ ] A module with `#test` can declare memory, call functions, and use `assert`.
- [ ] `runTests` executes all `#test` modules.
- [ ] Normal `cycle` execution skips `#test` modules.
- [ ] Failed assertions call `test.assertFailed(assertIndex, expected, received)` without requiring the import to throw.
- [ ] Passing assertions produce no failure callback.
- [ ] Compiler output exposes assertion metadata for source-level failure reporting.

## Affected Components

- `packages/compiler-spec` - Instruction specs, directive names, compiler result metadata types.
- `packages/compiler/packages/tokenizer` - Syntax validation for `#test` and `assert` arguments.
- `packages/compiler/src` - Directive handling, `assert` codegen, test runner export generation, assertion metadata collection.
- `packages/compiler-worker` - Test-capable compile/runtime integration if tests are run from the editor worker.
- `packages/cli` - CLI command or mode for running 8f4e tests.
- `packages/editor` - Optional editor surfacing for test results.
- `packages/compiler/docs` - Language docs for `#test`, `assert`, and test runner ABI.

## Risks & Considerations

- **Import compatibility**: Adding a `test.assertFailed` import changes the WebAssembly import shape for test-capable builds. Keep normal builds stable unless assertions are allowed in production modules.
- **Directive semantics**: `#test` should remain a module classification flag. Avoid adding a second module-like block type unless a later requirement truly needs different syntax.
- **Assertion indexing**: Macro expansion and source line metadata need care so assertion failures point at the user-visible call site.
- **Production assertions**: Since `assert` is allowed in any module, document whether production runtimes must provide the `test.assertFailed` import or whether assertions are only codegen-valid in test-capable builds.
- **Float assertions**: Deliberately out of scope for v1 to avoid approximate-comparison policy decisions.

## Related Items

- **Related**: `docs/todos/150-add-test-module-type.md` - Earlier broader idea for a dedicated test module type; this TODO supersedes the block-type direction with a `#test` module directive.

## References

- Conversation design notes from 2026-05-29:
  - Test modules should behave just like modules.
  - `#test` exists only to partition normal `cycle` modules from `runTests` modules.
  - `assert` owns test behavior by comparing values and calling a host import on failure.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to:
   - Move the TODO from the "Active TODOs" section to the "Completed TODOs" section
   - Add the completion date to the TODO entry (use `date +%Y-%m-%d` command if current date is not provided in the context)
