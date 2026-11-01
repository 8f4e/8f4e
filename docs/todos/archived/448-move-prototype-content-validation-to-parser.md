---
title: 'TODO: Move prototype content validation to parser'
priority: Medium
effort: 4-8h
created: 2026-06-01
issue: https://github.com/8f4e/8f4e/issues/944
status: Cancelled
completed: 2026-09-07
---

# TODO: Move Prototype Content Validation to Parser

## Problem Description

`parsePrototypeAST()` currently walks every parsed prototype AST line and rejects any non-boundary line that is not a memory declaration.

Unlike constants blocks, this check is not currently pure duplication: prototypes do not enter the normal module/function compile and stack-validation pipeline. Removing the check without replacing it would allow executable lines inside prototypes until prototype-body expansion is implemented deliberately.

The validation still belongs closer to parsing, because the tokenizer/parser owns prototype block construction and can reject non-memory prototype body lines from the source-block context without adding derived indexes to `PrototypeAST`.

## Proposed Solution

Move prototype content validation into the tokenizer/parser source-block builder.

Current rule:

- `prototype` and `prototypeEnd` are boundary lines.
- memory declaration lines are allowed.
- every other instruction is rejected with `INSTRUCTION_NOT_ALLOWED_IN_BLOCK` or the nearest existing syntax/compiler diagnostic boundary.

When prototype body expansion is implemented, this rule should be updated deliberately to split prototype contents into memory-shape lines and body lines, rather than relying on the old compiler-side rejection loop.

## Implementation Plan

### Step 1: Add Parser-Owned Validation

- Update `packages/compiler/packages/sub-program/packages/tokenizer/src/parser.ts`.
- While applying prototype AST lines, reject non-memory, non-boundary instructions according to the current rule.
- Keep accepted memory declaration lines source ordered in `PrototypeAST.lines`.

### Step 2: Remove Compiler-Side Prototype Loop

- Delete the per-line validation loop from `parsePrototypeAST()` in `packages/compiler/src/index.ts`.
- Keep the block-type assertion that verifies prototype inputs are actually prototype blocks.

### Step 3: Preserve Prototype Error Coverage

- Keep `executable-in-prototype.error.8f4e` or equivalent coverage.
- Add tokenizer/parser unit coverage if needed so the parser-level rule is explicit.
- Ensure diagnostics still point at the invalid prototype line.

### Step 4: Coordinate With Prototype Body Expansion

- When `docs/todos/443-add-prototype-body-expansion.md` is implemented, revisit this validation.
- Replace the rejection of executable prototype lines with parser-owned body-line collection.

## Success Criteria

- [ ] Prototype content validation no longer lives in `parsePrototypeAST()`.
- [ ] Parser/tokenizer tests cover invalid executable instructions inside prototypes.
- [ ] Compiler error fixtures still reject executable prototype lines until prototype body expansion changes that rule.
- [ ] Prototype body expansion has a clear place to update the rule later.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/parser.ts`
- `packages/compiler/packages/sub-program/packages/tokenizer/src/parser.test.ts`
- `packages/compiler/src/index.ts`
- `packages/compiler/tests/errors/prototypes/`
- `docs/todos/443-add-prototype-body-expansion.md`

## Risks & Considerations

- **Error domain**: Decide whether this should remain a compiler semantic diagnostic or become a tokenizer syntax diagnostic. Since it depends on source-block context but not symbol resolution, tokenizer/parser ownership is likely appropriate.
- **Future body support**: Do not hard-code assumptions that make prototype body expansion harder. Keep the parser structure ready to collect body lines later.
- **No compatibility burden**: The software has not been released yet, so update internal APIs directly and do not add compatibility shims.
