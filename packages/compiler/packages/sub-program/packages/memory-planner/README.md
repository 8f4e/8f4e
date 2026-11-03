# @8f4e/memory-planner

`@8f4e/memory-planner` decides module addresses and memory declaration addresses for a sub-program.

The sub-program-level entry point receives validated module and prototype ASTs plus constant-resolution facts:

```ts
const memoryPlan = planSubProgramMemoryLayout({
	prototypes,
	modules,
	constantReferences,
	startingByteAddress,
});
```

The planner builds planner-ready memory layout source from those ASTs:

- `prototypes`: prototype ids with normalized memory declaration lines.
- `modules`: module ids and ordered layout source lines.

Modules are allocated in alphabetical order by module id, independent from source or execution order. Module layout source lines are either memory declarations or `shape` lines. The planner expands `shape` lines into effective declaration sources, then plans those declarations in order within each module.

The returned plan contains:

- `moduleList`: planned modules in layout order.
- `modules`: planned modules keyed by id.
- `declarationSources`: effective declaration source lines for each planned module, including inherited `shape` declarations.

## Ownership

This package owns:

- Module byte addresses.
- Memory declaration byte addresses.
- Building planner-ready memory layout source from validated ASTs.
- Declaration order after `shape` expansion.
- Declaration size and type layout facts.
- Unknown `shape` prototype references, because layout cannot be planned without them.

This package does not own:

- Constant resolution.
- Memory-reference inlining.
- Default value resolution.
- Pointer target metadata overlays.
- Function parameter shape expansion.
- Code generation or stack/type validation.

The planner reads constant-resolution facts before normalizing declaration sizes. It expects array element counts to become literal planner-ready values after those facts and pure literal arithmetic are applied. Layout-dependent declaration sizes, such as `int[] dest count(source)`, are not supported.

All modules share one linear address space, with a single allocation cursor starting at `startingByteAddress`.

For a declaration, `allocationUnitCount` counts the 4-byte allocation units consumed, including any leading
float64 alignment padding. The declaration's `allocatedByteLength` and `endByteAddress` describe its storage from
the aligned `byteAddress`, excluding that leading padding. Cursor advancement and module sizes still include the
padding, so later declarations and modules keep their positions.
