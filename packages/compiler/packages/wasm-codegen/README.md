# @8f4e/wasm-codegen

Assigns WebAssembly function and type indices, encodes lowered bodies, and assembles the final binary. It also owns
initial memory data segments and memory-import sizing.

Function and module emission consumes Wasm IR from the compilation pipeline. The IR already contains the body-local
bindings and operations, including scratch locals. The emitter translates symbolic local, function, assertion, and
block-type references into Wasm operands.

The source AST and stack metadata pass through to compiled artifacts for tooling and diagnostics.
