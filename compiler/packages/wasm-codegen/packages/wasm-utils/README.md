# @8f4e/compiler-wasm-utils

`@8f4e/compiler-wasm-utils` provides low-level WebAssembly byte construction helpers.

The package exports deterministic utilities for:

- WebAssembly constants, loads, stores, calls, locals, and control-flow instruction bytes.
- LEB128, IEEE-754, string, vector, and prefixed-instruction encoding.
- Type, import, export, memory, data, name, function, and code section construction.
- Bulk-memory instruction helpers.
- Effective memory size derivation and WebAssembly version/header helpers.

This package owns raw WASM byte encoding and structural section builders. It should stay independent from 8f4e source semantics.

This package does not own:

- Parsing 8f4e source or validating compiler ASTs.
- Deciding instruction semantics, stack effects, memory layout, or compiler pass order.
- Emitting complete 8f4e programs from compiler reports.

Higher-level WebAssembly emission for compiled 8f4e programs belongs to `@8f4e/wasm-codegen`, which consumes these helpers.
