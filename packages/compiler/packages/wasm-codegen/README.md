# @8f4e/wasm-codegen

WebAssembly code generation for 8f4e.

This package owns bytecode emission, instruction compilers, WebAssembly local storage, function bodies, initial memory data segments, memory-import sizing, and final section assembly.

Module and function emitters consume resolved executable bodies and stack-analysis facts. Function signatures, imports, exports, expanded parameters, and module execution directives arrive as metadata. Declaration instructions do not enter the instruction dispatcher. Arithmetic and call operand shorthand has already been lowered to ordinary resolved pushes; codegen neither expands source operands nor handles deferred references. Stack facts are aligned with executable body positions, not source-line indexes.

Codegen assigns WebAssembly indexes to source binding identities, placing parameters first, and allocates anonymous temporary locals for loops, maps, arithmetic, clamps, and memory guards. Every physical allocation is retained in index order separately from source-binding lookups, so declarations include all storage with its correct Wasm type even when operations share source line numbers. Temporary consumers retain binding handles; intentional reuse is explicit and limited to compatible types and non-overlapping value lifetimes, such as successive pointer-load steps or byte writes. Source names do not participate in storage lookup. Allocating a later source local cannot change which binding an earlier instruction references.

Source ASTs remain attached to compiled output for tooling and diagnostics. Codegen does not replay those ASTs, resolve source references, validate syntax, repeat stack analysis, or decide compiler pass ordering.

Target-independent semantic helpers belong in `@8f4e/semantic-utils`. Language constants and instruction metadata belong in `@8f4e/language-spec`.
