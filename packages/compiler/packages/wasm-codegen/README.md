# @8f4e/wasm-codegen

Serializes a lowered Wasm module. It assigns function, type, and data segment indices, encodes instructions, and
assembles the binary sections. The caller receives emitted bodies and indices keyed by symbolic function ID for
assembling source metadata.
