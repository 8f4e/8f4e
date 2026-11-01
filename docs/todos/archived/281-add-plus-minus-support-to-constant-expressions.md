---
title: 'TODO: Add Plus/Minus Support to Constant Expressions'
priority: Medium
effort: 4-8h
created: 2026-02-23
issue: https://github.com/8f4e/8f4e/issues/416
status: Completed
completed: 2026-04-25
---

# TODO: Add Plus/Minus Support to Constant Expressions

## Problem Description

Compile-time constant expressions currently support only `CONST*number` and `CONST/number` with a single operator. This blocks simple offset-style expressions like `SIZE+1` or `SIZE-1` in `const`, declarations, `push`, and `init`.

## Proposed Solution

Extend the constant expression parser and resolver to support `+` and `-` while preserving the current one-operator rule.

Supported forms should become:
- `CONST+number`
- `CONST-number`
- `CONST*number`
- `CONST/number`

## Implementation Plan

### Step 1: Extend syntax helper
- Update `parseConstantMulDivExpression` (or rename it) to parse `+` and `-`.
- Keep validation strict: exactly one operator and uppercase constant name on the left.

### Step 2: Extend constant resolver
- Update resolver logic in `resolveConstantValue` utilities to evaluate add/sub operations.
- Keep existing error behavior for undeclared identifiers and division-by-zero.

### Step 3: Add tests and docs
- Add/adjust unit tests for parser and resolver.
- Add instruction-level tests for `const`, `push`, `init`, and declaration defaults.
- Update compiler docs to include `+` and `-` examples.

## Success Criteria

- [ ] `CONST+number` and `CONST-number` resolve at compile time where constant expressions are currently supported.
- [ ] Existing `*` and `/` behavior remains unchanged.
- [ ] Exactly-one-operator validation still enforced.
- [ ] Tests and docs cover the new forms.

## Affected Components

- `packages/compiler/src/syntax/parseConstantMulDivExpression.ts`
- `packages/compiler/src/utils/resolveConstantValue.ts`
- `packages/compiler/tests/instructions/constantExpressions.test.ts`
- `packages/compiler/docs/instructions/declarations-and-locals.md`
- `packages/compiler/docs/instructions/memory.md`
- `packages/compiler/docs/instructions/stack.md`

## Risks & Considerations

- **Parsing ambiguity**: `-` can also appear in numeric literals; parser rules must continue to distinguish operator vs literal sign.
- **Backward compatibility**: Existing expression and error semantics should remain stable.
