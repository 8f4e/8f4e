# @8f4e/language-spec

`@8f4e/language-spec` contains shared language contracts and target-independent facts for the compiler pipeline.

This package is the place for data and types that describe the 8f4e language itself:

- AST, argument, diagnostic, cache, and compiled-output contracts.
- `ProjectObjectModel` and its project block, group, entry, identity, and include-resolver contracts.
- Instruction names, instruction specs, source argument shape rules, stack signatures, and instruction effects.
- Memory declaration types, memory data contracts, and memory layout metadata types.
- Function type limits, function signature helpers, parameter shape metadata, and runtime option contracts.
- Compiler error codes and shared error metadata.
- Assertion host import names and default no-op bindings (`IGNORED_ASSERTION_IMPORTS`) for hosts that ignore assertions.

The package is intentionally declarative. Other compiler packages import these facts so they agree on the same language model.

`FunctionSignature.parameters` contains `{ name, type }` entries in declaration order, including fields expanded by
`paramShape`. Function identities and WebAssembly types depend only on the parameter types. When stack analysis is
requested, call lines expose `CompiledStackAnalysisLine.resolvedCall` with the selected target ID and its complete
function signature, including calls to generated entry dispatchers.

This package does not own:

- Parsing source text into ASTs. That belongs to `@8f4e/tokenizer`.
- Parsing `.8f4e` text into `ProjectObjectModel` or resolving include source. That belongs to
  `@8f4e/project-preparser` behind the public compiler API.
- Compiler pass orchestration. That belongs to `@8f4e/compiler`.
- Memory layout, constant resolution, memory reference resolution, default resolution, stack analysis, or code generation.
- WebAssembly byte encoding helpers or WASM-specific section construction.

When adding a new shared truth, prefer deriving it from an existing spec table when possible instead of creating a second source of truth.
