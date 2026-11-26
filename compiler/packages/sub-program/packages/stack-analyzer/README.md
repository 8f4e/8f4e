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

Each report contains execution facts indexed by body operation position and the final stack. A separate source-level stack view groups operations by their original source-line index so its snapshots and consumed and produced values describe the whole source instruction. The source view includes function-end validation. Each source line also records `consumedOperandProducerLines`, an ordered list of the block-relative lines that immediately produced its consumed operands. A parallel producer stack is derived from the grouped source effects, so inline operands stay part of their source instruction, and restored block or conditional results belong to `blockEnd` or `ifEnd`. Call results belong to the call site. These references do not trace through locals, memory, function bodies, or earlier arithmetic inputs. Resolved units carry imports, exports, expanded parameters, locals, and module execution directives.

The analyzer owns operand checks, stack effects, block results, map compatibility, and address, pointer, clamp-range, and known-value propagation. It allocates no WebAssembly locals, including loop counters. Codegen consumes its execution facts without repeating stack analysis.
