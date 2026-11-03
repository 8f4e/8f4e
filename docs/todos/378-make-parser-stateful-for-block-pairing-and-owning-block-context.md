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
- syntax errors can still lack the owning top-level code block context (`module`, `function`, `constants`), which makes editor-side error routing harder or impossible in some cases

Example problem:
- a syntax error such as an unexpected `moduleEnd` can expose a real line number
- but if it does not carry the owning `module` or `function` id, the editor cannot reliably attach that error to a specific code block

Why this is a problem:
- syntax diagnostics still degrade to empty `codeBlockId` in cases where the parser could have known the owning top-level block
- parser-owned structural rules are spread across ad hoc local state instead of a more explicit stateful parsing model
- upcoming block-syntax work such as `block ... blockEnd [type]` wants the same kind of parser-owned pairing already used for `if`

## Proposed Solution

Make the parser explicitly stateful for structural block parsing and top-level ownership tracking.

Desired direction:
- track block nesting and matching start/end instructions during parsing
- track the current owning top-level code block context while parsing (`module`, `function`, `constants`)
- attach parser-owned linkage metadata for block constructs that need it
- attach owning top-level block context to syntax errors whenever it is known at parse time

Concrete outcomes:
- nested control-flow blocks such as `if`, `block`, and their closing instructions are paired by parser-owned state
- syntax errors inside a `module foo` block carry `context.codeBlockId = 'foo'` and `context.codeBlockType = 'module'`
- syntax errors inside a `function bar` block carry the corresponding function ownership context

This change is intentionally breaking at the parser/diagnostic contract level:
- no compatibility fallback or dual parser modes should be added
- existing parser/consumer assumptions should be updated directly
- the software is unreleased, so the cleaner stateful model should replace older ad hoc behavior outright

## Anti-Patterns

- Do not add hidden global parser state shared across unrelated parse calls.
- Do not keep structural pairing logic split between parser state and later compiler-side rewrites.
- Do not invent fake `codeBlockId` values when the owning block is not actually known.
- Do not add compatibility shims for both the old and new parser behavior.

## Implementation Plan

### Step 1: Define parser-owned structural state
- Introduce explicit per-parse state for nested block tracking.
- Represent the current owning top-level code block (`module`, `function`, `constants`) separately from nested control-flow blocks.

### Step 2: Generalize block pairing ownership
- Keep `if` pairing under parser ownership.
- Extend the same parser-owned pairing approach to other structural blocks that need matched start/end awareness.
- Avoid compiler-side normalization passes that reconstruct pairings later.

### Step 3: Attach owning block context to syntax diagnostics
- When a syntax error occurs inside a known top-level code block, attach its `codeBlockId` and `codeBlockType`.
- Preserve correct line metadata alongside that context.
- Leave context empty only when no owning top-level block has been established yet.

### Step 4: Add regression coverage
- Add parser tests for block pairing metadata across nested structures.
- Add syntax-error tests proving that parser-known `module` / `function` ownership is included in diagnostics.
- Add editor/compiler integration tests for syntax errors that must now resolve to the correct code block.

## Validation Checkpoints

- `npx nx run @8f4e/tokenizer:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/editor-state:test`
- `rg -n "INVALID_BLOCK_STRUCTURE|codeBlockId|codeBlockType|matchingIfEndIndex|matchingBlockEndIndex" packages/compiler packages/editor`

## Success Criteria

- [ ] The parser has an explicit stateful model for structural block parsing.
- [ ] Parser-owned block pairing is the source of truth for relevant block constructs.
- [ ] Syntax errors inside known top-level code blocks expose `codeBlockId` and `codeBlockType`.
- [ ] Editor-side syntax diagnostics no longer depend on missing block ownership for parser-known module/function/constants regions.
- [ ] No compatibility fallback remains for the older less-stateful parser behavior.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/parser.ts` - parser state, block pairing, and top-level ownership tracking
- `packages/compiler/packages/sub-program/packages/tokenizer/src/types.ts` - parser-owned linkage metadata for structural blocks
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/syntaxError.ts` - syntax diagnostics carrying parser-known context
- `packages/compiler/src/diagnostic.ts` - preserve parser-supplied line/context in serialized diagnostics
- `packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/effect.ts` - consume syntax diagnostics with parser-known block ownership
- `packages/compiler/tests/` and `packages/compiler/packages/sub-program/packages/tokenizer/src/` - parser and integration coverage

## Risks & Considerations

- **Scope drift**: keep this focused on parser state for structure and ownership, not semantic analysis.
- **Boundary creep**: the parser should own syntax structure and parser-known block identity, but not stack/type reasoning.
- **Context timing**: syntax errors that occur before a top-level owning block is established may still legitimately have empty context.
- **Related work overlap**: this should complement, not replace, the separate module-batch parsing todo.

## Related Items

- **Related**: `docs/todos/archived/371-move-block-result-type-to-blockend-and-drop-explicit-void.md`
- **Related**: `375-unify-syntax-and-compiler-error-shapes.md`
- **Related**: `archived/377-batch-parse-modules-and-validate-shared-ids.md`

## Notes

- This todo exists separately so parser statefulness for structural syntax ownership is not hidden inside the `blockEnd` syntax cleanup or the batch module parsing todo.
