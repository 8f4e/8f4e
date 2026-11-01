# @8f4e/stack-analyzer

This package validates executable stacks and propagates execution facts for resolved module and function bodies.

```ts
const stackReport = analyzeStack({
	semanticReferences,
	memoryPlan,
	pointerMetadataByModuleId,
	functions,
	functionTypeRegistry,
});
```

Resolved bodies already contain source binding identities and declaration metadata. The analyzer tracks local value types by binding identity, independently of WebAssembly storage. It validates function returns against registered signatures and matches call overloads using stack operand types.

Each report contains execution facts indexed by body operation position, the final stack, and function usage. A separate source-level stack view groups operations by their original source-line index: its before/after snapshots and consumed/produced values describe the whole source instruction. Function-end validation is included in that source view rather than the executable operation facts. Imports, exports, expanded parameters, locals, and module execution directives belong to the resolved units, not the stack report.

The analyzer owns operand checks, stack effects, block results, map compatibility, and address, pointer, clamp-range, and known-value propagation. It allocates no WebAssembly locals, including loop counters. Codegen consumes its execution facts without repeating stack analysis.
