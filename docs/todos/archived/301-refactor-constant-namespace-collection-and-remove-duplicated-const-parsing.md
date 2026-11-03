---
title: 'TODO: Refactor constant namespace collection and remove duplicated const parsing'
priority: High
effort: 1-2d
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/412
status: Completed
completed: '2026-03-30'
---

# TODO: Refactor constant namespace collection and remove duplicated const parsing

Superseded by the current semantic architecture. The old framing was based on pre-semantic-refactor files and no longer matches the compiler structure:
- `const` handling now lives in semantic normalization and semantic instruction application
- namespace construction now goes through `buildNamespace.ts`
- the remaining issue should be tracked against the current semantic const pipeline, not the old `collectConstants`/instruction-compiler split

## Problem Description

The compiler currently has two separate paths that parse and validate `const` declarations:

- [packages/compiler/src/astUtils/collectConstants.ts](packages/compiler/src/astUtils/collectConstants.ts)
- [packages/compiler/src/instructionCompilers/const.ts](packages/compiler/src/instructionCompilers/const.ts)

These two paths do not behave the same way.

The instruction compiler path is guarded correctly:
- it checks for missing arguments
- it validates constant naming
- it validates whether the assigned value is a literal or a resolvable constant expression
- it throws proper compiler errors through `getError(...)`

The namespace collection path is not guarded correctly:
- it scans every `const` line in the AST
- it assumes `_arguments[1]` exists
- it assumes `_arguments[1]` has a `.value`
- it can throw raw JavaScript errors such as `Cannot read properties of undefined (reading 'value')`

This produces a bad failure mode:
- the compiler crashes before normal semantic compilation
- the thrown error has no compiler `line`
- the thrown error has no compiler `context`
- the editor receives no `codeBlockId`, `codeBlockType`, or mapped line number

This is exactly what happens for input like:

```txt
const MY_CONST
```

The immediate symptom is poor diagnostics, but the deeper issue is duplicated compiler logic with inconsistent validation.

## Important Finding

`collectConstants(...)` is not dead code left over from the old globally scoped constants model.

It is still actively used to build namespace data in [packages/compiler/src/index.ts](packages/compiler/src/index.ts):

- during `compileModules(...)`
- during top-level namespace construction before modules and functions are compiled

That namespace registry is then consumed by [packages/compiler/src/instructionCompilers/use.ts](packages/compiler/src/instructionCompilers/use.ts), which imports constants from:

- constants blocks
- modules

The current docs still describe this model:
- constants blocks provide named namespaces
- `use` imports constants from another namespace
- constants defined in modules can also be imported using `use`

So the current conclusion is:
- the *purpose* of the pre-pass is still valid
- the *implementation* of the pre-pass is brittle and partially duplicative

## Proposed Solution

Refactor constant handling so there is exactly one source of truth for parsing and validating `const` declarations, while keeping an explicit namespace collection phase.

Recommended architecture:

1. `compileToAST(...)`
2. `collectNamespaces(...)`
3. compile functions/modules using the validated namespace registry

The key change is:
- keep a namespace collection phase
- remove ad hoc `const` parsing from `collectConstants(...)`
- move constant declaration parsing into a shared helper used by both the namespace collector and the `const` instruction compiler

## Why This Is Better

This refactor would:

- eliminate duplicated `const` parsing logic
- eliminate raw JavaScript crashes from malformed constant declarations
- guarantee that namespace collection and normal compilation enforce the same rules
- preserve the current `use`-based namespace model
- make the compiler architecture more explicit: pre-pass for declarations, compile pass for codegen

## Recommended Design

### 1. Introduce a shared const declaration parser

Create a helper with a shape similar to:

```ts
parseConstDeclaration(line, context?)
```

Expected responsibilities:
- validate that the line is structurally a valid `const` declaration
- validate the constant name
- validate or resolve the assigned value
- return a normalized declaration result such as:
  - `name`
  - `value`
  - `isInteger`
  - `isFloat64`

This helper should be the single source of truth for:
- missing argument handling
- identifier-vs-literal validation
- constant naming rules
- constant expression resolution rules

### 2. Replace `collectConstants(...)` with namespace-aware collection

Instead of a loose AST filter that scans every `const` instruction, introduce a more explicit namespace collection phase, for example:

```ts
collectNamespaces(astModules): Namespaces
```

This phase should:
- determine the namespace name of each top-level module/constants block
- collect only importable constants for that namespace
- use the shared const parser for validation
- throw proper compiler errors with AST line information when declarations are invalid

This is still a pre-pass, but it becomes a real semantic declaration collector rather than a fragile extractor.

### 3. Keep `const.ts`, but make it delegate

The `const` instruction compiler should still exist, because constants are also part of normal semantic compilation inside the current block context.

However, instead of duplicating parsing rules, it should delegate to the shared helper and then write the validated result into:

```ts
context.namespace.consts
```

### 4. Keep namespace collection scoped to importable constants

The namespace collector should only gather constants that are meant to be importable via `use`.

That likely means:
- constants blocks
- module-level `const` declarations

It should not blindly collect:
- function-local constants
- malformed declarations that happen to use the `const` opcode

This keeps namespace behavior intentional and avoids accidental leakage.

## Anti-Patterns

- Do not delete the pre-pass outright unless `use` is redesigned at the same time.
- Do not keep `collectConstants(...)` as a second independent parser with more patches bolted onto it.
- Do not fix the immediate crash by adding null checks only in `collectConstants(...)` without removing the duplicated parsing model.
- Do not derive importable namespace constants from fully compiled modules after the fact; that hides declaration-phase errors and mixes phases.

## Implementation Plan

### Step 1: Extract a shared const declaration helper

- Add a helper that accepts an AST line and returns a normalized constant declaration.
- Move all `const` validation rules into that helper.
- Ensure it throws `getError(...)` with the original AST line.

Expected outcome:
- one place defines what a valid `const` declaration is

### Step 2: Replace `collectConstants(...)`

- Remove the direct argument indexing logic from [packages/compiler/src/astUtils/collectConstants.ts](packages/compiler/src/astUtils/collectConstants.ts)
- Either:
  - replace it with a new `collectNamespaceConstants(...)`, or
  - remove it entirely in favor of `collectNamespaces(...)`

Expected outcome:
- no raw `.value` access on unvalidated AST arguments

### Step 3: Build namespaces through validated declarations

- Update [packages/compiler/src/index.ts](packages/compiler/src/index.ts) to build `namespaces` from the new collector
- Ensure `use` still reads from the same namespace model
- Keep current behavior for constants blocks and modules unless intentionally changed

Expected outcome:
- `use` remains functional
- namespace data is validated and consistent

### Step 4: Delegate `const.ts` to the shared helper

- Update [packages/compiler/src/instructionCompilers/const.ts](packages/compiler/src/instructionCompilers/const.ts)
- Remove duplicated parsing/validation logic there

Expected outcome:
- namespace collection and normal compilation agree on every `const` rule

### Step 5: Add regression tests for malformed declarations

Add tests for at least:
- missing assigned value
- invalid constant name
- invalid non-literal/non-resolvable value
- malformed constants block declaration

Expected outcome:
- malformed constant declarations always produce compiler errors with line/context

## Validation Checkpoints

- `rg -n "collectConstants\\(" packages/compiler/src`
- `rg -n "instructionCompilers/const" packages/compiler/src`
- `rg -n "use instruction|imports constants from another namespace" packages/compiler/src packages/compiler/docs`
- `npx nx run compiler:test`

Additional specific checks:
- `const MY_CONST` should throw a proper compiler error, not a raw `TypeError`
- the thrown error should include `line`
- the thrown error should include `context.codeBlockId`
- the editor should be able to map the error to the originating block

## Success Criteria

- [ ] There is exactly one shared parser/validator for `const` declarations.
- [ ] Namespace collection no longer directly indexes AST arguments without validation.
- [ ] Malformed constant declarations never throw raw JavaScript property-access errors.
- [ ] `use` continues to work with constants blocks and module namespaces.
- [ ] Compiler errors from malformed constants include usable line and block metadata.

## Affected Components

- [packages/compiler/src/index.ts](packages/compiler/src/index.ts) - Namespace construction should move to a validated declaration collector.
- [packages/compiler/src/astUtils/collectConstants.ts](packages/compiler/src/astUtils/collectConstants.ts) - Replace or remove the current loose extractor.
- [packages/compiler/src/instructionCompilers/const.ts](packages/compiler/src/instructionCompilers/const.ts) - Delegate to shared parsing logic.
- [packages/compiler/src/instructionCompilers/use.ts](packages/compiler/src/instructionCompilers/use.ts) - Must keep consuming the namespace registry correctly.
- [packages/compiler/src/types.ts](packages/compiler/src/types.ts) - May need a declaration result type or collector result type.
- [packages/compiler/tests](packages/compiler/tests) - Add malformed-declaration regressions and update any tests touching namespace collection.

## Risks & Considerations

- **Behavioral scope**: This can subtly change which constants are considered importable if block scoping is not defined carefully.
- **Expression support**: If constant expressions are allowed in normal compilation, the shared helper must preserve that behavior in namespace collection too.
- **Block-awareness**: A trivial filter over `const` instructions is not enough if importable constants should exclude function-local declarations.
- **Breaking changes**: It is acceptable to break internal APIs here because the software is not released yet. Clarity is more important than preserving the current helper boundaries.

## Related Items

- **Related**: [docs/todos/292-refactor-error-systems-and-document-syntax-vs-compiler-error-boundaries.md](docs/todos/292-refactor-error-systems-and-document-syntax-vs-compiler-error-boundaries.md)
- **Related**: `use` namespace behavior in [packages/compiler/docs/instructions/program-structure-and-functions.md](packages/compiler/docs/instructions/program-structure-and-functions.md)

## Notes

- The current bug with `const MY_CONST` failing as `Cannot read properties of undefined (reading 'value')` is strong evidence that duplicated parsing has already diverged.
- The key conclusion from source inspection is: `collectConstants(...)` is not obsolete, but its current implementation is the wrong abstraction.
- The likely correct long-term shape is a dedicated declaration collection phase, not a pile of AST extractors.
