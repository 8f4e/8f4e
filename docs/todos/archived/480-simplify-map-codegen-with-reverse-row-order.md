---
title: 'TODO: Simplify map codegen with reverse row order'
priority: Medium
effort: 2-4h
created: 2026-09-06
issue: https://github.com/8f4e/8f4e/issues/955
status: Completed
completed: 2026-10-09
---

# TODO: Simplify Map Codegen With Reverse Row Order

## Problem Description

The compiler emits branchless WebAssembly for `mapBegin` / `map` / `mapEnd` blocks, with the first matching source
row taking precedence. The current implementation allocates four temporary locals: input, result, matched, and
condition. Every row updates the matched flag and checks it before selecting a result.

This bookkeeping adds runtime instructions and emitted bytes even though map keys and values are compile-time
constants. It can be removed while preserving first-match-wins behavior.

## Proposed Solution

Emit map rows in reverse source order, retaining only the input and result locals:

1. Save the input and initialize the result to the explicit default or the existing typed zero.
2. Iterate from the last row to the first without mutating the source row array.
3. For each row, emit `result = select(row.value, result, input == row.key)`.
4. Push the final result.

Earlier source rows execute last and overwrite later matches, so duplicate keys still select the first source row.
Keep the existing zero-row path, which drops the input and pushes the default. Preserve the existing input and output
type handling for `int`, `float`, and `float64`.

No public API or language syntax change is required. Keep this task focused on map lowering.

## Preliminary Measurements

An isolated experiment on 2026-09-06 compared the current lowering with reverse-order emission on Node 24.16.0.
Each timing sample made one million calls to an exported integer lookup function. Two runs used alternating variant
order, discarded warmup rounds, and compared median timings. Fixtures included a duplicate key and an explicit default;
both variants returned the expected values for matching and nonmatching inputs and produced valid WebAssembly.

| Rows | Observed runtime improvement | Complete fixture Wasm size, before → after |
| ---- | ---------------------------- | ------------------------------------------------ |
| 4 | Little difference | 233 → 163 bytes |
| 16 | About 3.3× faster | 563 → 315 bytes |
| 64 | About 2.3–2.4× faster | 1,907 → 939 bytes |

These are exploratory microbenchmarks, not whole-application speedups or acceptance thresholds. Reproduce the comparison
as a one-time implementation check; the initial scripts were temporary. Floating-point behavior was not covered by the
initial experiment.

## Implementation Plan

- Replace forward iteration and matched/condition bookkeeping in `mapEnd.ts` with reverse-order selection.
- Remove the two unused local allocations and opcode imports; update the lowering explanation.
- Add focused runtime coverage and update bytecode snapshots for the intentional output change.
- Record a one-time benchmark for small and larger maps, including runtime and emitted size.

## Success Criteria

- [x] Nonempty maps allocate only input and result temporaries.
- [x] First-match-wins behavior is preserved for duplicate keys.
- [x] Empty maps, one-row maps, unmatched inputs, explicit defaults, and implicit typed-zero defaults behave as before.
- [x] Integer, float32, and float64 input/output combinations retain their existing behavior.
- [x] Float coverage includes NaN inputs, signed-zero keys and results, and distinct source keys that encode to the same
      float32 value; preserve Wasm comparison behavior rather than deduplicating keys using JavaScript equality.
- [x] Generated Wasm validates and runtime results match the existing lowering.
- [x] Snapshots demonstrate removal of matched/condition bookkeeping, and repeated benchmarks record the actual gain.

## Affected Components

- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/mapEnd.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/mapEnd.test.ts` and its snapshots
- `packages/compiler/tests/instructions/map.test.8f4e` and its compile-result snapshot

## Validation Checkpoints

- `npx nx run @8f4e/wasm-codegen:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run-many --target=typecheck --projects=@8f4e/wasm-codegen,@8f4e/compiler`
- Compare baseline and optimized runtime and Wasm size using the same fixtures and runtime version.

## Related Items

- [TODO 273: Add map block instruction family](273-add-map-block-instruction-family.md)

## Completion Notes

- Completed on 2026-10-09. Reverse iteration leaves source rows unchanged and removes the matched/condition locals and
  all their bookkeeping opcodes.
- Added a nonempty-map bytecode/local snapshot. Runtime coverage lives in the executable
  `map-numeric-types.test.8f4e` and `map-numeric-edge-cases.test.8f4e` project fixtures, alongside the existing map fixture.
  These cover every numeric input/output combination, defaults, duplicate keys, nonfinite inputs, float32 precision,
  and signed-zero bits. JavaScript tests remain only for internal local allocation and source-row immutability.
- Full `@8f4e/wasm-codegen` and `@8f4e/compiler` test suites and typechecks passed.
- A one-time comparison on Node v24.16.0 measured complete 64-row fixture size falling from 1,863 to 895 bytes; runtime
  improved 2.40–2.47× in the isolated lookup benchmark. The 16-row fixture improved 2.07–2.12×; the 4-row fixture mainly
  benefited from smaller bytecode. The executable benchmark, its report, and the AGENTS.md benchmark instructions were
  removed during review; there is no recurring benchmark workflow.
