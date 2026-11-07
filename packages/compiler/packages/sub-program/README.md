# @8f4e/sub-program

Internal compiler orchestration package. It is available only through the `@8f4e/sub-program/internal` subpath used by
`@8f4e/compiler`; project-facing consumers use `parseProjectSource` and `compileProject` from the compiler facade.

The package consumes the validated-AST program produced by `@8f4e/program-composer` and runs the global compilation
passes that produce emission-ready module, function, and memory artifacts. No separate source-level project contract is
exposed; `ProjectObjectModel` remains owned by `@8f4e/language-spec`.

All recursively owned projects have already been flattened with isolated internal symbols at this boundary. Memory
addresses and function/type indexes are therefore assigned once for the complete program, avoiding a linker or
relocation layer before final WebAssembly emission. Function registration resolves signatures and `paramShape` expansions
once, including imports, exports, and impurity flags. Semantic resolution consumes these registered declarations and
assigns source binding identities while producing executable bodies without declarations. Stack analysis consumes those
bodies and produces execution facts. Function analysis then reports imports, explicit/early returns, and recursion
using the resolved call graph, including entry/module execution paths. These facts remain independent of optimization
policy and are exposed on every compiled function as `analysis`.
With `inlineFunctions` enabled, function inlining then selects bounded call-site expansions before final Wasm layout.
Codegen assigns WebAssembly local indexes and emits bytecode from resolved bodies, stack facts, and optional inline
plans. It isolates each copied callee's locals and control flow and resets source locals for every invocation.
The original ASTs remain unchanged for diagnostics and compiled output; the registry remains available
for matching calls.

Source-name arity and overload-count dictionaries have no object prototype, so names such as `constructor`, `toString`, `hasOwnProperty`, and `__proto__` remain valid function identifiers through registration and registry merging. Function ids still include their parameter signature, and duplicate signatures and invalid overload sets keep their existing diagnostics.
