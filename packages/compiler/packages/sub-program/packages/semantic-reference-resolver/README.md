# @8f4e/semantic-reference-resolver

This pass resolves source bindings and produces executable module and function bodies after constants, memory layout, pointer counts, and function registration are available.

Function registration supplies resolved signatures, imports, exports, impurity flags, and `paramShape` expansions. The resolver consumes those declarations once. It assigns each parameter and local declaration a binding identity, so references keep their original target even when a later declaration reuses the name.

The output contains:

- immutable source ASTs for diagnostics and compiled output;
- registered function metadata;
- source bindings with types and parameter positions, without WebAssembly local indexes;
- executable bodies containing resolved arguments, binding references, ordinary operand pushes, and shape expansions;
- module execution metadata such as `skipExecutionInCycle`.

Declaration instructions are absent from executable bodies. Loop defaults and `#loopCap` are normalized into explicit loop caps. Body array positions identify executable operations; each operation also retains its original source-line index as provenance. Arithmetic and call operands are expanded here into ordinary resolved pushes followed by a stack-only operation. Several operations may therefore share one source line. Unresolved push arguments cannot cross this handoff. Memory IO restrictions on pure functions are checked here, after resolving pointer dereferences.

Stack analysis and codegen consume these bodies directly. They do not replay declarations or resolve source names. This pass does not parse source, validate syntax, construct constant namespaces, plan memory, validate execution stacks, or emit WebAssembly.
