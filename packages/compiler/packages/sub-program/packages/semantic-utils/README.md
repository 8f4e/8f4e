# @8f4e/semantic-utils

Target-independent semantic helpers shared by the compiler pipeline and code generation packages.

This package owns reusable semantic context construction, memory-plan lookup helpers, and small stack/block utilities that are not specific to a bytecode target or a single compiler pass.

It should not emit WebAssembly bytes, allocate target-specific function indexes beyond language-level metadata, or materialize WASM sections.

`createCompilationContext` initializes semantic pass state. Bytecode emission uses the separate
`CodegenContext` and constructor in `@8f4e/wasm-codegen`, with only resolved function metadata,
native locals, bytecode, and diagnostic context. Both contexts share `BlockState` tracking through
`createBlockState`, `pushBlock`, and `popBlock`; loop frames retain the metadata owned by their stage.
Block tracking keeps the ordered `blockStack`, `activeLoopBlocks`, and `activeMapBlock` without duplicating block depths or boolean placement flags.
