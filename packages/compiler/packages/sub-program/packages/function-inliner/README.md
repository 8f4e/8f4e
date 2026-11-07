# @8f4e/function-inliner

Plans bounded, single-level function expansions after stack, assertion, and structural function analysis, immediately
before WebAssembly layout and code generation. The compiler enables this pass only when requested:

```ts
await compileProject(project, { inlineFunctions: true });

await compileProject(project, {
	inlineFunctions: {
		maxCalleeOperations: 32,
		maxCallerOperations: 1024,
	},
});
```

Both omitted `inlineFunctions` and `false` preserve the original emission path. `true` uses the defaults shown above.
Budgets are measured in analyzed operations, not bytes or execution time. The callee budget excludes a terminal
return. The caller budget includes parameter stores, source-local resets, and the enclosing result block/end.

The pass consumes resolved bodies, operation-indexed stack facts, `FunctionAnalysisReport`, and planned assertion
sites. It returns `FunctionInliningPlan` from `@8f4e/language-spec`: maps from each original caller operation index to
an eligible callee body. It processes functions and module bodies in source operation order. Imported functions,
recursive functions, and functions with early returns remain calls. Generated entry dispatchers remain calls too.
A final explicit return is omitted from the copy. Calls inside copied bodies stay ordinary calls, even if the
standalone callee's own emission plan selects those same calls for expansion.

Codegen creates a fresh local namespace and physical storage for each selected call site. It saves already evaluated
arguments once in reverse declaration order, zeros the callee's source locals on every invocation, and emits the
body inside a block matching its return signature. That block preserves the original implicit function label and
isolates pending caller operands. Compiler-generated temporaries remain in the copied scope and initialize through
their existing instruction compilers. Caller and copied locals are declared in physical allocation order.

All standalone functions and exports remain present, retaining function indices. Memory layout, original ASTs,
source-level stack views, and structural analysis remain unchanged. Assertions retain the callee's original source
site and local bindings. The pass does not specialize stack facts for caller values or perform dead-code elimination.

From the repository root, run `npx nx run @8f4e/function-inliner:build|test|typecheck|lint`. Compiler API tests inspect
emitted calls and execution; the executable compiler fixture catalog also runs with inlining enabled.
