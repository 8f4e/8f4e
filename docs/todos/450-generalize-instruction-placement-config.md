---
title: 'TODO: Generalize instruction placement config'
priority: Medium
effort: 4-8h
created: 2026-06-08
issue: https://github.com/8f4e/8f4e/issues/945
status: Open
completed: null
---

# TODO: Generalize Instruction Placement Config

## Problem Description

Instruction placement rules live in `packages/compiler/packages/language-spec/src/instructionSpecs.ts`, and the tokenizer already enforces
many of them generically: source-block ownership, nested block requirements, disallowed nested blocks, and block
parent/closure rules.

However, not every placement rule is represented in that shared config yet. Prologue-only rules are currently
special-cased for compiler directives in the tokenizer, and other prologue-like language constructs, such as function
parameters, are enforced later in codegen:

```ts
if (localCount > paramCount || context.byteCode.length > 0) {
	throw getError(ErrorCode.PARAM_AFTER_FUNCTION_BODY, line, context);
}
```

That check is stale in spirit. Whether `param` or `paramShape` appears after the function body has started is one
example of a source-placement concern and should be rejected by the parser/tokenizer based on language-spec placement
metadata.

## Proposed Solution

Extend the instruction placement config so specs can express all source-placement checks through one generic model.

The goal is not to add a one-off `param` rule or a separate prologue-only system. Instead, add reusable placement
concepts that can cover:

- compiler directives that must appear in a module/function directive prologue;
- function parameter declarations that must appear before function body instructions;
- future placement-only constraints that are source-order, block-position, or neighboring-instruction concerns rather
  than semantic/codegen concerns.

Named prologue scopes are the first concrete rule this TODO should unlock. The tokenizer should track those scopes from
spec metadata and close them when it sees an instruction that is not allowed to remain in that prologue. Instruction
specs should declare which prologue an instruction belongs to or requires.

## Proposed Shape

The exact API can be adjusted during implementation, but the placement config should be generic and extensible. For
example:

```ts
placement: {
	sourceBlocks: ['function'],
	prologue: {
		requires: 'function-params',
		participatesIn: ['function-params'],
	},
}
```

or a simpler equivalent:

```ts
placement: {
	sourceBlocks: ['function'],
	prologue: 'function-params',
}
```

Avoid encoding behavior in instruction names. The tokenizer should consume declarative placement metadata from
`instructionSpecs.ts`.

## Anti-Patterns

- Do not add a hardcoded tokenizer branch just for `param` or `paramShape`.
- Do not add a second placement system beside `InstructionPlacement`.
- Do not keep compatibility shims for the old codegen-time placement check; the software is unreleased.
- Do not move duplicate parameter-name validation into placement rules. Duplicate names still require semantic/local
  registration context, especially when `paramShape` expands multiple parameters.
- Do not make compiler directives the only prologue-aware instruction class. The model should support multiple named
  prologues.

## Implementation Plan

### Step 1: Model Generic Placement Rules

- Extend `InstructionPlacement` in `packages/compiler/packages/language-spec/src/instructionSpecs.ts` with reusable placement rule shapes.
- Add named prologue placement as the first new rule, but keep the model open to other source-order checks.
- Decide whether prologue state should be named by string literals such as `block-directives` and `function-params`.
- Keep the API reusable for future placement constraints instead of tying it to directive or parameter names.

### Step 2: Move Directive Prologue Rules Into Specs

- Replace directive-specific tokenizer prologue checks with spec-driven placement metadata.
- Preserve the existing behavior for `#impure`, `#export`, `#import`, `#loopCap`, and `#skipExecution`.
- Preserve `isBlockPrologue` metadata for directive lines if consumers still need it.

### Step 3: Add Function Parameter Prologue Rules

- Mark `param` and `paramShape` as function-parameter prologue instructions.
- Ensure both can be freely mixed while the function parameter prologue is open.
- Close the function parameter prologue on the first non-participating body/local instruction.
- Reject late `param` and `paramShape` in the tokenizer with a syntax/placement diagnostic.

### Step 4: Remove Codegen Placement Checks

- Remove the `localCount > paramCount || context.byteCode.length > 0` position check from
  `packages/compiler/src/instructionCompilers/param.ts`.
- Keep local registration and duplicate parameter-name validation in codegen/semantic code.
- Keep parameter count tracking only for local-index partitioning and function parameter limit checks, if still needed.

### Step 5: Add Parser And Compiler Coverage

- Add tokenizer tests for late `param` and late `paramShape`.
- Keep or update compiler error fixtures so the behavior is covered at the public compile surface.
- Update snapshots impacted by moving the diagnostic phase earlier.

## Success Criteria

- [ ] Source-placement checks are represented in `InstructionPlacement` rather than tokenizer/compiler instruction-name
      branches.
- [ ] Prologue placement is one generic placement rule, not a directive-only special case.
- [ ] Existing compiler directive prologue behavior is preserved through generic placement metadata.
- [ ] `param` and `paramShape` are rejected after function body/local instructions during tokenization.
- [ ] The codegen-time `PARAM_AFTER_FUNCTION_BODY` placement check is removed.
- [ ] Duplicate parameter-name validation remains intact.
- [ ] Tests cover directive prologues, late `param`, and late `paramShape`.

## Affected Components

- `packages/compiler/packages/language-spec/src/instructionSpecs.ts` - add generic placement metadata for source-order rules.
- `packages/compiler/packages/sub-program/packages/tokenizer/src/mainTokenizerLoop.ts` - enforce generic prologue placement.
- `packages/compiler/packages/sub-program/packages/tokenizer/src/index.test.ts` - add parser placement coverage.
- `packages/compiler/src/instructionCompilers/param.ts` - remove stale placement check.
- `packages/compiler/tests/errors/` - update public diagnostic coverage if the error domain changes.

## Risks & Considerations

- **Error domain**: Late `param`/`paramShape` should become syntax/placement errors rather than semantic/codegen errors.
- **Multiple prologues**: Directive and function-parameter prologues have different closure rules, so the model should
  support named prologues instead of a single global prologue flag.
- **Directive metadata**: Existing `isBlockPrologue` metadata may still be useful for directive consumers. Preserve it
  unless there is a cleaner replacement in the same change.
- **No compatibility burden**: The software is unreleased, so remove stale internal APIs directly.

## Related Items

- **Related**: `docs/todos/449-add-function-param-shape.md`
- **Related**: `docs/todos/448-move-prototype-content-validation-to-parser.md`
- **Related**: `docs/todos/archived/402-restrict-compiler-directives-to-block-prologue.md`
