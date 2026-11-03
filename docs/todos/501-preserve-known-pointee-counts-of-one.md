---
title: 'TODO: Preserve known pointee counts of one'
priority: Medium
effort: 1-2h
created: 2026-10-16
issue: https://github.com/8f4e/8f4e/issues/1042
status: Open
completed: null
---

# TODO: Preserve known pointee counts of one

## Problem Description

`count(*pointer)` fails when a pointer is initialized from a known scalar or one-element array. The compiler reports
`POINTEE_ELEMENT_COUNT_UNKNOWN` (error 58), even though the initializer proves that exactly one element is available.
Counts of zero and two are retained correctly.

Reproduction through `parseProjectSource` and `compileProject` with `enableAssertions: true`:

```8f4e
8f4e/v1
entry test
module singleElement
int[] values 1 7
int* pointer &values
push count(*pointer)
assertEqual 1
moduleEnd
entryEnd
```

Expected: compilation succeeds and the assertion passes. Actual: compilation fails with error 58.
Replacing the array declaration with `int values 7` reproduces the same failure.

`updatePointerMemoryMetadata` discards `pointeeElementCount === 1`. That legacy representation treats one as an implicit
count, while the current query resolver requires explicit count metadata and distinguishes an absent count from a known
one. This bug reproduces on both the base of PR #1041 (`dc612a3cc`) and its initial cleanup commit (`c7d08633c`); the
multi-memory removal did not introduce it.

## Proposed Solution

Store every proven pointee count, including one. Leave the count absent when initialization does not prove it.
Preserve unknown-count diagnostics rather than guessing a count from pointer type or its runtime numeric value.

## Implementation Plan

1. Remove the count-one exclusion in memory-reference resolution while retaining clearing of unknown metadata.
2. Add compiler integration coverage for scalar, one-element array, and group-initializer pointer sources.
3. Cover zero, one, and multiple elements, plus an unknown pointer and an end-address initializer.
4. Update snapshots to include explicit `pointeeElementCount: 1` where appropriate.

## Validation Checkpoints

- Compile and execute the reproduction through the public compiler and shared test runner.
- Run `npx nx run-many --target=test --projects=@8f4e/memory-reference-resolver,@8f4e/compiler`.
- Run affected typechecks and inspect pointer-metadata snapshot changes.

## Success Criteria

- [ ] `count(*pointer)` resolves to one for a known scalar or one-element array initializer.
- [ ] A group address initializer preserves a known count of one.
- [ ] Zero and larger known counts retain their current behavior.
- [ ] Unknown and end-address-only provenance still produce `POINTEE_ELEMENT_COUNT_UNKNOWN` where applicable.
- [ ] Integration tests exercise supported source compilation and assertion execution.

## Affected Components

- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/index.ts`
- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/resolveMemoryExpressionOperand.ts`
- `packages/compiler/packages/sub-program/packages/semantic-reference-resolver/src/referenceResolvers/push.ts`
- Compiler fixtures and pointer-metadata snapshots.

## Risks & Considerations

- Snapshot changes are expected because the compiler will retain a previously omitted fact.
- Keep this fix separate from removing unused count fallback helpers and redundant default-resolver forwarding;
  neither cleanup requires changing the count-one behavior.

## Related Items

- [Separate pointer type and provenance facts](431-separate-pointer-type-and-provenance-facts.md)
- [Nest pointer metadata shape](430-nest-pointer-metadata-shape.md)
- [PR #1041: Remove multiple Wasm memory support](https://github.com/8f4e/8f4e/pull/1041)
