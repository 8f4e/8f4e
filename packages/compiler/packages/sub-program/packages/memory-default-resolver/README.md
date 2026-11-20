# @8f4e/memory-default-resolver

`@8f4e/memory-default-resolver` resolves memory declaration defaults after memory layout and memory references are resolved.

The package reads the completed `@8f4e/memory-planner` layout plus the `@8f4e/memory-reference-resolver` report. The plan is the source of truth for module order, declaration order, declaration type facts, and the effective declaration source lines produced by `shape` expansion. The memory-reference report supplies resolved default/initializer arguments for those declaration sources.

```ts
const memoryDefaultsByModuleId = resolveMemoryDefaults({
	memoryPlan,
	memoryReferences,
});
```

The result is the `memoryDefaultsByModuleId` record: scalar defaults, array initializer defaults, and explicit-default
flags keyed by module and declaration id. The input needs only the memory-reference report's
`declarationSourcesByModuleId` facts. Pointer element counts remain owned by the memory-reference pass; orchestration
passes those facts directly to semantic resolution, stack analysis, and compiled output.

This package does not decide addresses, expand `shape` declarations, expand function parameter shapes, validate duplicate declarations, resolve memory references, or compile instructions.
