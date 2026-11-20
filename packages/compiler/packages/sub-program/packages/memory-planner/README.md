# @8f4e/memory-planner

`@8f4e/memory-planner` decides module addresses and memory declaration addresses for a sub-program.

The sub-program-level entry point receives validated module ASTs plus constant-resolution facts:

```ts
const memoryPlan = planSubProgramMemoryLayout({
	modules,
	constantReferences,
	startingByteAddress,
});
```

The planner collects module IDs and ordered memory declarations from those ASTs.

Modules are allocated in alphabetical order by module id, independent of source or execution order. Within a
module, the planner allocates memory declarations in source order and rejects a second declaration with the same
name. Anonymous declarations are not subject to the name check.

The returned plan contains:

- `moduleList`: planned modules in layout order.
- `modules`: planned modules keyed by id.
- Each module's `declarations` lists every allocation in source order. Its zero-based index is the declaration ID,
  and each declaration carries its `source` line.
- Each module's `memory` looks up the same declaration objects by name. Anonymous declarations appear only in
  `declarations`.

## Ownership

This package owns:

- Module byte addresses.
- Memory declaration byte addresses.
- Building planner-ready memory layout source from validated ASTs.
- Memory declaration order.
- Declaration size and type layout facts, and uniqueness of named allocations within a module.

This package does not own:

- Constant resolution.
- Memory-reference inlining.
- Default value resolution.
- Pointer target metadata overlays.
- Code generation or stack/type validation.

The planner reads constant-resolution facts before normalizing declaration sizes. It expects array element counts to become literal planner-ready values after those facts and pure literal arithmetic are applied. Layout-dependent declaration sizes, such as `int[] dest count(source)`, are not supported.

All modules share one linear address space, with a single allocation cursor starting at `startingByteAddress`.

For a declaration, `allocationUnitCount` counts the 4-byte allocation units consumed, including any leading
float64 alignment padding. The declaration's `allocatedByteLength` and `endByteAddress` describe its storage from
the aligned `byteAddress`, excluding that leading padding. Cursor advancement and module sizes still include the
padding, so later declarations and modules keep their positions.
