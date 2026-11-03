---
title: 'TODO: Tighten compiler AST union and source block types'
priority: Medium
effort: 2-4d
created: 2026-05-25
issue: https://github.com/8f4e/8f4e/issues/686
status: Completed
completed: 2026-05-25
---

# TODO: Tighten compiler AST union and source block types

## Problem Description

`ASTLine` is currently typed as `ASTLineBase<string, Array<Argument>>`, even though `compiler-spec` defines many narrow line aliases. This broad central type erases tokenizer guarantees about instruction names and argument shapes.

As a result, compiler phases still check or cast argument shapes for instructions whose arity and raw argument classes were already validated by the tokenizer.

The overall goal is to preserve strict parse-time facts across the tokenizer-to-compiler boundary. Once tokenizer syntax validation has accepted `module <identifier>` or `param <type> <identifier>`, compiler code should not need to handle those lines as arbitrary strings with arbitrary argument arrays. Runtime checks should remain for semantic facts that require compiler state, such as duplicate declarations or undeclared identifiers.

## Project Compatibility Note

This project has not been released yet and we own the whole codebase. Do not add compatibility layers, legacy aliases, adapter shims, or fallback paths just to preserve broad internal interfaces. Prefer changing the type contracts directly and updating all call sites in the repo.

## Proposed Solution

Introduce a typed compiler AST union and source-block-level types:

- a `CompilerASTLine` discriminated union of known compiler line shapes;
- a typed fallback only for intentionally unknown/document-only lines if needed;
- `ModuleAst`, `FunctionAst`, and `ConstantsAst` source block types that encode required prologue/epilogue lines where practical;
- helper predicates such as `isModuleLine`, `isFunctionLine`, and `isSemanticInstructionLine` that narrow to exact line types.

Deploy this by tightening the canonical compiler AST contracts and updating compiler consumers away from broad `AST[number]`. Temporary migration helpers are acceptable only inside the same change and should be removed before completion.

This is the broadest part of the hardening work: it turns tokenizer-owned guarantees into reusable static contracts. It should be done carefully and incrementally, but the end state should not retain older broad helper types as compatibility layers.

## Implementation Plan

### Step 1: Add the Union Types

- Export a `CompilerASTLine` union from `packages/compiler-spec/src/ast.ts`.
- Consider separating parsed line types from normalized/codegen line types.
- Avoid compatibility aliases; if temporary migration helpers are unavoidable within the change, remove them before marking the TODO complete.

### Step 2: Type Parser Output

- Update tokenizer parser construction to return typed compiler lines after `validateInstructionArguments(...)`.
- Add narrow helpers for instructions where TypeScript cannot infer the validated shape directly.

### Step 3: Type Source Blocks

- Add source-block types for module, function, and constants ASTs.
- Update compile entrypoints and namespace collection helpers to use the source-block types where they require a module or function prologue.

### Step 4: Remove Redundant Shape Checks

- Remove downstream checks and casts that exist only because `AST[number]` was broad.
- Keep semantic validation that depends on symbol tables, stack state, or compiler state.

## Validation Checkpoints

- Run `npx nx run compiler-spec:typecheck`.
- Run `npx nx run tokenizer:typecheck`.
- Run `npx nx run compiler:typecheck`.
- Run `npx nx run compiler:test`.
- Check `rg -n "arguments\\[0\\]\\?\\.type|as \\{ type: typeof ArgumentType.IDENTIFIER" packages/compiler/src packages/compiler/packages/tokenizer/src`.

## Success Criteria

- [x] Compiler AST consumers can narrow by `line.instruction` to exact argument tuple types.
- [x] Module/function metadata collection no longer revalidates prologue argument shape.
- [x] Function return type parsing no longer casts raw arguments to identifiers.
- [x] Existing syntax validation remains tokenizer-owned.
- [x] Compiler and tokenizer tests/typechecks pass.

## Affected Components

- `packages/compiler-spec/src/ast.ts`
- `packages/compiler-spec/src/semantic.ts`
- `packages/compiler/packages/tokenizer/src/parser.ts`
- `packages/compiler/src/semantic/buildNamespace.ts`
- `packages/compiler/src/graphOptimizer.ts`
- `packages/compiler/src/compiler.ts`

## Risks & Considerations

- **Blast radius**: This is the broadest hardening task and should be last.
- **Migration risk**: Many tests and helper literals may rely on broad `AST[number]` assignment; update those fixtures and helpers directly rather than preserving broad aliases.
- **Validation boundary**: Do not move semantic checks into tokenizer just to make the AST type narrower.
- **Wrong-goal risk**: Do not keep broad AST types and compensate with more runtime shape checks. The objective is to make syntax-validated shapes statically known downstream.

## Related Items

- **Follows**: `413-split-compiled-function-lifecycle-types.md`
- **Follows**: `414-split-compiler-context-phase-types.md`
- **Follows**: `415-discriminate-compiler-block-stack-frames.md`
- **Follows**: `416-add-resolved-identifier-line-forms.md`
- **Related**: archived TODO `345-tighten-tokenizer-to-compiler-contract-with-typed-ast-lines.md`
