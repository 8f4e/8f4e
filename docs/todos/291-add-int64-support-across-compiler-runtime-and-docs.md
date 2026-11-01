---
title: 'TODO: Add int64 support across compiler, runtime, and docs'
priority: Medium
effort: 2-4d
created: 2026-03-09
issue: https://github.com/8f4e/8f4e/issues/553
status: Open
completed: null
---

# TODO: Add int64 support across compiler, runtime, and docs

## Problem Description

The language already has dedicated `float64` support, including 64-bit memory allocation and type-aware compiler paths, but there is no equivalent `int64` support.

That leaves an obvious gap:
- users can store 64-bit floating-point values
- users cannot declare or manipulate 64-bit integer values directly

Desired direction:
- `int64`
- `int64*`
- `int64**`
- `int64[]`

Potential unsigned variants such as `int64u` / `int64u[]` should be considered explicitly, but they do not need to be bundled into the first pass unless the implementation cost is small and semantics are clear.

## Proposed Solution

Add first-class signed `int64` support across compiler, memory declarations, stack typing, runtime memory access, and user-facing documentation.

High-level scope:
- Add `int64`, `int64*`, `int64**`, and `int64[]` to the memory type surface.
- Represent 64-bit integers with WebAssembly `i64` where the compiler/runtime path supports it.
- Preserve the existing 4-byte allocation grid while aligning 8-byte values correctly, mirroring the `float64` approach.
- Extend relevant instruction compilers so `int64` values are loaded, stored, pushed, and type-checked correctly.
- Document supported operations and any limitations clearly.

Because JavaScript number semantics cannot precisely represent all 64-bit integers, the implementation must decide how host-side values are represented:
- `bigint`
- split high/low words
- restricted numeric range with explicit caveats

The recommended direction is to use `bigint` for host/runtime-facing `int64` values wherever precision matters.

## Anti-Patterns

- Do not pretend `number` can losslessly represent general signed 64-bit integers.
- Do not add `int64` declarations without updating downstream consumers like live memory patching and memory views.
- Do not silently coerce `int64` values through float paths.
- Do not partially document the feature; users need explicit guidance on supported instructions, limits, and host-side representation.

## Implementation Plan

### Step 1: Add `int64` memory type support
- Extend memory declaration parsing and flags to include `int64`, `int64*`, `int64**`, and `int64[]`.
- Set `elementWordSize = 8` and reuse 8-byte alignment handling similar to `float64`.
- Decide whether pointer declarations to `int64` still use 32-bit addresses while pointing at 64-bit data, and document that explicitly.

### Step 2: Introduce `i64` stack/type support
- Extend type metadata, stack items, locals/params/results, and validation helpers to represent `i64`.
- Ensure mixed-width integer operations are either supported explicitly or rejected with clear errors.
- Review instruction helpers that currently assume integer means `i32`.

### Step 3: Add instruction/compiler paths
- Add `i64` support to the relevant instruction compilers, starting with the minimum useful surface:
  - `push`
  - `store`
  - loads from memory-backed identifiers
  - locals/params/results where applicable
- Decide which arithmetic/comparison instructions support `int64` in the first pass and which remain out of scope.
- Add or extend opcode utilities for `i64.const`, `i64.load`, `i64.store`, and core arithmetic/comparison opcodes as needed.

### Step 4: Add runtime and host-side support
- Add `BigInt64Array`-based or equivalent runtime memory access for `int64` memory items.
- Update compiler-worker/live-memory patching so `int64` defaults can be written safely.
- Update editor/web-ui/debugger/plotter integration to avoid precision loss and display `int64` values sensibly.

### Step 5: Add comprehensive tests and docs
- Add declaration, compilation, and runtime tests for `int64` allocation, push/load/store, and host-side memory access.
- Add negative tests for unsupported mixed-width operations or invalid coercions.
- Document syntax, supported instructions, representation strategy, and limitations.

## Validation Checkpoints

- `rg -n "float64|i64|int64|BigInt64Array" packages/compiler packages/editor packages/runtime docs`
- `npx nx run-many --target=test --projects=compiler,editor,web-ui`
- `npx nx run-many --target=typecheck --all`

## Success Criteria

- [ ] `int64`, `int64*`, `int64**`, and `int64[]` declarations compile and allocate correctly with 8-byte alignment.
- [ ] Compiler type tracking distinguishes `i64` from existing `i32`, `f32`, and `f64` paths.
- [ ] The minimum supported instruction surface for `int64` is documented and works end to end.
- [ ] Host/runtime memory access preserves 64-bit integer precision without routing through lossy `number` conversions.
- [ ] Docs clearly explain syntax, semantics, and current limitations.

## Affected Components

- `packages/compiler/src/instructionCompilers` - Add `int64` declaration and instruction support.
- `packages/compiler/src/types.ts` - Extend memory/stack/type metadata for 64-bit integers.
- `packages/compiler/src/wasmUtils` - Add or expose `i64` opcodes/utilities where needed.
- `packages/compiler/src/utils` - Update memory parsing, alignment, validation, and resolution helpers.
- `packages/editor` and `packages/editor/packages/editor-core/packages/web-ui` - Add host/runtime handling and rendering support for `int64` memory values.
- `packages/editor/packages/compiler-worker` or equivalent live-update path - Add safe `int64` default patching.
- `packages/compiler/docs` - Add comprehensive `int64` documentation.

## Risks & Considerations

- **JavaScript precision**: `number` cannot safely represent full signed 64-bit integer range, so representation strategy is the central design decision.
- **Instruction surface area**: Full `i64` parity with `i32` may be large; define a staged rollout if needed.
- **Runtime integration**: WebAssembly `i64` interop and JS `bigint` handling must remain consistent across compiler, runtime, and editor layers.
- **UI impact**: Existing controls like sliders or plotters may need to reject or specially handle `int64` values.
- **Documentation scope**: This feature requires clear docs on both capabilities and intentional limitations.

## Related Items

- **Related**: `docs/todos/249-add-float64-allocation-support-on-4-byte-grid.md`
- **Related**: `docs/todos/250-add-float64-push-support.md`
- **Related**: `docs/todos/258-add-f64-store-support.md`
- **Related**: `docs/todos/260-add-float64-support-in-function-signatures.md`

## Notes

- Initial scope should prioritize signed `int64` first.
- Unsigned `int64` support can be a follow-up if needed.
- Comprehensive docs should be part of the feature, not deferred cleanup.
