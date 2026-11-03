---
title: 'TODO: Extract compiler diagnostics package'
priority: Medium
effort: 2-4h
created: 2026-06-15
issue: https://github.com/8f4e/8f4e/issues/950
status: Open
completed: null
---

# TODO: Extract Compiler Diagnostics Package

## Problem Description

Compiler diagnostic ownership is currently split across package boundaries:

- `@8f4e/language-spec` owns shared diagnostic shapes and `ErrorCode`.
- `packages/compiler/src/compilerError.ts` owns `getError(...)` and the default compiler error messages.
- compiler-adjacent packages such as `@8f4e/constant-resolver` cannot emit normal compiler diagnostics without
  importing compiler internals or throwing a package-local error that the compiler wraps at the integration boundary.

This keeps package boundaries clean, but it makes shared diagnostics feel adapter-heavy as more compiler subpackages
appear.

## Proposed Solution

Create a small `@8f4e/compiler-diagnostics` package that depends on `@8f4e/language-spec` and owns compiler diagnostic
construction.

The package should export:

- `getError(...)`;
- the default message registry for `ErrorCode`;
- shared detail formatting types/helpers;
- lightweight helpers for attaching source/block diagnostic context if they can stay generic.

Keep `@8f4e/language-spec` focused on shared types, codes, and structural contracts. Keep phase-specific context
assembly in the compiler or the package that owns the phase.

## Anti-Patterns

- Do not make compiler-adjacent packages import `packages/compiler/src/compilerError.ts`.
- Do not move broad compiler phase logic into the diagnostics package.
- Do not let diagnostics depend on tokenizer, compiler, or constant-resolver implementation details.
- Do not turn `language-spec` into the message-formatting package unless a dedicated diagnostics package proves too
  costly.

## Implementation Plan

### Step 1: Create the Package

- Add `packages/compiler/packages/diagnostics`.
- Configure Nx build, typecheck, test, and package metadata following nearby compiler subpackages.
- Add a dependency on `@8f4e/language-spec`.

### Step 2: Move Diagnostic Construction

- Move `getError(...)` and its detail formatting support out of `packages/compiler/src/compilerError.ts`.
- Re-export or replace compiler imports so current compiler code keeps using a stable import path.
- Keep error codes and diagnostic shapes in `@8f4e/language-spec`.

### Step 3: Update Compiler-Adjacent Packages

- Let packages such as `@8f4e/constant-resolver` decide whether to keep package-local domain errors or throw shared
  diagnostics directly when they have enough context.
- If a wrapper remains useful, make it a thin context adapter rather than a message-shaping adapter.

### Step 4: Validate Boundaries

- Confirm `@8f4e/compiler-diagnostics` has no dependency on `@8f4e/compiler`.
- Confirm `@8f4e/compiler` and compiler subpackages use the shared diagnostic package consistently.
- Add a small package-level test for representative diagnostics.

## Validation Checkpoints

- `npx nx run @8f4e/compiler-diagnostics:test`
- `npx nx run @8f4e/compiler-diagnostics:typecheck`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/compiler:typecheck`
- `rg -n "from './compilerError'|from '../compilerError'|compilerError" packages/compiler`

## Success Criteria

- [ ] `getError(...)` lives outside `packages/compiler/src`.
- [ ] compiler diagnostics remain message-compatible unless intentionally changed.
- [ ] compiler-adjacent packages can use shared diagnostic construction without depending on `@8f4e/compiler`.
- [ ] `@8f4e/language-spec` remains the home of diagnostic types and error codes, not message formatting.
- [ ] Existing compiler diagnostic snapshots pass or are updated only for intentional wording/context changes.

## Affected Components

- `packages/compiler/src/compilerError.ts` - likely deleted, reduced to a re-export, or moved.
- `packages/compiler/packages/language-spec/src/errors.ts` - remains the source of error codes and diagnostic types.
- `packages/compiler/packages/sub-program/packages/constant-resolver` - candidate consumer for shared diagnostics.
- `packages/compiler/packages/sub-program/src/compileSubProgram.ts` - current `ConstantResolverError` wrapper may become thinner.

## Risks & Considerations

- **Package churn**: another compiler subpackage is justified only if more than one package needs diagnostic construction.
- **Boundary creep**: the diagnostics package should not learn compiler phase semantics.
- **Snapshot churn**: moving message construction should preserve existing diagnostic messages by default.

## Related Items

- **Related**: `docs/todos/292-refactor-error-systems-and-document-syntax-vs-compiler-error-boundaries.md`
- **Related**: `docs/todos/archived/458-decouple-module-execution-order-from-memory-layout.md`
- **Related**: PR #808, which introduced the constant resolver package and a local-to-compiler diagnostic adapter.
