---
title: 'TODO: Rename compiler allocation-grid metadata to allocation-unit terminology'
priority: Medium
effort: 8-16h
created: 2026-05-26
issue: https://github.com/8f4e/8f4e/issues/712
status: Completed
completed: 2026-10-19
---

# TODO: Rename compiler allocation-grid metadata to allocation-unit terminology

## Problem

The compiler lays out memory on a fixed four-byte allocation grid, currently represented by
`GLOBAL_ALIGNMENT_BOUNDARY`. Several names describe positions or counts on that grid as “word aligned,” while
`BASE_TYPE_METADATA.wordSize` and `elementWordSize` describe the byte width of an actual typed value.

Those are different concepts. For example, `wordAlignedSize` is not a typed word size: it is the number of four-byte
allocation units reserved for a declaration or module. A scalar `float64` normally consumes two allocation units,
while four `int8` elements consume one.

The ambiguous allocation-grid names are exposed through compiler options and `CompileResult.memoryPlan`, then consumed
throughout the compiler, compiler worker, editor, CLI, runtimes, tests, and snapshots.

## Goal

Use explicit allocation-unit terminology for values tied to the compiler's four-byte layout grid, while retaining
word-size terminology where it genuinely describes a typed value or memory-access width.

Suggested renames:

| Current name | Suggested name |
| --- | --- |
| `GLOBAL_ALIGNMENT_BOUNDARY` | `ALLOCATION_UNIT_BYTE_SIZE` |
| `wordAlignedAddress` | `allocationUnitAddress` |
| `wordAlignedSize` | `allocationUnitCount` |
| `wordAlignedByteLength` | `allocatedByteLength` |
| `startingMemoryWordAddress` | `startingMemoryAllocationUnitAddress` |
| `localWordOffset` | `localAllocationUnitOffset` |
| `nextLocalWordOffset` | `nextLocalAllocationUnitOffset` |
| `getByteAddressFromWordOffset` | `getByteAddressFromAllocationUnitOffset` |
| `getAbsoluteWordOffset` | `getAbsoluteAllocationUnitOffset` |
| `alignAbsoluteWordOffset` | `alignAbsoluteAllocationUnitOffset` |
| `getWordAlignedByteLength` | `getAllocatedByteLength` |

The final names may be adjusted during implementation if a clearer consistent vocabulary emerges, but a value ending
in `Count` must be a count and a value ending in `ByteLength` must be measured in bytes.

## Breaking-change boundary

`startingMemoryWordAddress` is part of `CompileOptions`, and the layout fields are present in
`CompileResult.memoryPlan`. Renaming them is therefore a breaking compiler API change.

Implement this as an intentional breaking change using the repository's Conventional Commit policy (`!` and/or a
`BREAKING CHANGE` footer), so release tooling produces the appropriate major versions. Update all in-repository
callers atomically; do not keep duplicate old/new fields, compatibility aliases, getters, or migration shims.

## Non-goals

Do not rename concepts where “word size” means the storage width of a typed value rather than an allocation-grid
coordinate. In particular, keep these unless a separate issue explicitly changes them:

- `BASE_TYPE_METADATA.wordSize`
- `elementWordSize`
- pointee/dereferenced element word-size helpers and metadata
- byte/half-word/word/double-word memory-access-width constants
- APIs that genuinely index a typed 32-bit memory view rather than expose compiler layout metadata

Do not change allocation behavior, alignment, emitted Wasm, memory addresses, sizes, defaults, or runtime semantics.

## Implementation outline

1. Rename the allocation-unit constant and public layout contracts in
   `packages/compiler/packages/language-spec/src/`.
2. Rename allocation-grid locals and helpers in
   `packages/compiler/packages/sub-program/packages/memory-planner/src/`.
3. Update every compiler-stage consumer, including memory defaults/references, stack analysis, code generation, and
   initial-memory segments.
4. Update compiler-worker, editor, CLI, and runtime consumers of the renamed options and memory-plan fields.
5. Update tests, fixtures, snapshots, documentation, and examples. Avoid mechanical changes to the typed-word concepts
   listed under non-goals.
6. Confirm that before/after compilation produces identical byte addresses, allocation lengths, required memory,
   initialized bytes, and executable behavior.

The obsolete `currentModuleNextWordOffset` and `currentModuleWordAlignedSize` fields are no longer part of this task;
they have already been removed from active source.

## Acceptance criteria

- [ ] The four-byte allocation-grid constant uses allocation-unit terminology.
- [ ] Public memory-plan addresses, counts, and allocated byte lengths use explicit units.
- [ ] The starting-memory compiler option uses allocation-unit terminology.
- [ ] Memory-planner locals and helper names consistently distinguish allocation units from bytes and typed element
      widths.
- [ ] All repository consumers use the new names; no compatibility aliases or duplicate fields remain.
- [ ] Genuine typed-word metadata remains unchanged.
- [ ] Memory layout and generated-program behavior are unchanged.
- [ ] The change is documented and released as breaking.

## Validation

Run at minimum:

```sh
npx nx run @8f4e/language-spec:typecheck
npx nx run @8f4e/memory-planner:test
npx nx run @8f4e/memory-planner:typecheck
npx nx run @8f4e/compiler:test
npx nx run @8f4e/compiler:typecheck
npx nx run-many --target=typecheck --all
```

Also run focused tests for any affected editor, compiler-worker, CLI, or runtime packages and use an active-source
search to confirm that obsolete allocation-grid names remain only in intentional historical or migration
documentation.

## Risk and scope

This is a broad, mechanical but API-breaking rename. It should be reviewed for unit correctness rather than bundled
with behavioral refactors. Snapshot churn is expected; semantic output changes are not.

## Related items

- `docs/todos/423-narrow-ast-line-metadata-interfaces.md`
- `docs/todos/392-move-shared-compiler-constants-to-language-spec.md`
