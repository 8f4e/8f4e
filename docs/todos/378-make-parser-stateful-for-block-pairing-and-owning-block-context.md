---
title: 'TODO: Make parser stateful for block pairing and owning block context'
priority: Medium
effort: 4-8h
created: 2026-04-08
issue: https://github.com/8f4e/8f4e/issues/560
status: Open
completed: null
---

# TODO: Make parser stateful for block pairing and owning block context

## Problem Description

The tokenizer/parser already owns some cross-line structural syntax concerns such as `if` pairing and block-closure validation, but that statefulness is still too narrow in two important ways:
- block-structure pairing is not yet a clearly generalized parser capability across all relevant block instructions
- structural parsing must preserve the explicit source ownership supplied by its caller (`module`, `function`, `constants`) so editor error routing remains reliable

Example problem:
- a syntax error such as an unexpected `moduleEnd` can expose a real line number
- its location must also retain the caller-supplied project block identity to target the corresponding editor block

Why this is a problem:
- mutable compilation context and symbol names must not replace the caller-supplied `diagnosticSource` when locating structural syntax failures
- parser-owned structural rules are spread across ad hoc local state instead of a more explicit stateful parsing model
- upcoming block-syntax work such as `block ... blockEnd [type]` wants the same kind of parser-owned pairing already used for `if`

## Proposed Solution

Make the parser explicitly stateful for structural block parsing and top-level ownership tracking.

Desired direction:
- track block nesting and matching start/end instructions during parsing
- preserve the supplied `DiagnosticSource` separately from structural parser state (`module`, `function`, `constants`)
- attach parser-owned linkage metadata for block constructs that need it
- attach the supplied source ownership and zero-based row to syntax errors at the parser boundary

Concrete outcomes:
- nested control-flow blocks such as `if`, `block`, and their closing instructions are paired by parser-owned state
- syntax errors inside a `module foo` block retain its supplied block identity, project group path, and source row in `location`
- syntax errors inside a `function bar` block retain that function's supplied source ownership

This change is intentionally breaking at the parser/diagnostic contract level:
- no compatibility fallback or dual parser modes should be added
- existing parser/consumer assumptions should be updated directly
- the software is unreleased, so the cleaner stateful model should replace older ad hoc behavior outright

## Anti-Patterns

- Do not add hidden global parser state shared across unrelated parse calls.
- Do not keep structural pairing logic split between parser state and later compiler-side rewrites.
- Do not invent project block identities when the caller supplies document ownership.
- Do not add compatibility shims for both the old and new parser behavior.

## Implementation Plan

### Step 1: Define parser-owned structural state
- Introduce explicit per-parse state for nested block tracking.
- Keep caller-supplied source ownership separate from nested control-flow blocks.

### Step 2: Generalize block pairing ownership
- Keep `if` pairing under parser ownership.
- Extend the same parser-owned pairing approach to other structural blocks that need matched start/end awareness.
- Avoid compiler-side normalization passes that reconstruct pairings later.

### Step 3: Attach owning block context to syntax diagnostics
- When a syntax helper reports a failure, its caller constructs the diagnostic using the supplied `DiagnosticSource`.
- Preserve the correct zero-based row within that source.
- Use explicit document ownership when parsing a whole document; do not recover ownership from mutable compilation contexts.

### Step 4: Add regression coverage
- Add parser tests for block pairing metadata across nested structures.
- Add syntax-error tests proving that parser-known `module` / `function` ownership is included in diagnostics.
- Add editor/compiler integration tests for syntax errors that must now resolve to the correct code block.

## Validation Checkpoints

- `npx nx run @8f4e/tokenizer:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/editor-state:test`
- `rg -n "INVALID_BLOCK_STRUCTURE|diagnosticSource|matchingIfEndIndex|matchingBlockEndIndex" packages/compiler packages/editor`

## Success Criteria

- [ ] The parser has an explicit stateful model for structural block parsing.
- [ ] Parser-owned block pairing is the source of truth for relevant block constructs.
- [ ] Syntax errors retain their supplied source ownership and zero-based row in `location`.
- [ ] Editor-side syntax diagnostics no longer depend on missing block ownership for parser-known module/function/constants regions.
- [ ] No compatibility fallback remains for the older less-stateful parser behavior.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/parser.ts` - parser state, block pairing, and top-level ownership tracking
- `packages/compiler/packages/sub-program/packages/tokenizer/src/types.ts` - parser-owned linkage metadata for structural blocks
- `packages/compiler/packages/diagnostics/src/syntaxError.ts` - construct syntax diagnostics with caller-supplied source ownership
- `packages/compiler/packages/diagnostics/src/compilerError.ts` - preserve complete diagnostic locations during transport
- `packages/editor/plugins/compiler/src/diagnostic-presentation.ts` - consume supplied diagnostic locations directly
- `packages/compiler/tests/` and `packages/compiler/packages/sub-program/packages/tokenizer/src/` - parser and integration coverage

## Risks & Considerations

- **Scope drift**: keep this focused on parser state for structure and ownership, not semantic analysis.
- **Boundary creep**: the parser should own syntax structure and parser-known block identity, but not stack/type reasoning.
- **Source coordinates**: document rows and rows within a supplied block or scope must stay in their respective coordinate systems.
- **Related work overlap**: this should complement, not replace, the separate module-batch parsing todo.

## Related Items

- **Related**: `docs/todos/archived/371-move-block-result-type-to-blockend-and-drop-explicit-void.md`
- **Related**: `375-unify-syntax-and-compiler-error-shapes.md`
- **Related**: `archived/377-batch-parse-modules-and-validate-shared-ids.md`

## Notes

- This todo exists separately so parser statefulness for structural syntax ownership is not hidden inside the `blockEnd` syntax cleanup or the batch module parsing todo.
