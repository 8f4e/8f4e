# @8f4e/wasm-ir-lowering

Lowers resolved 8f4e operations to Wasm IR using the source stack report and planned assertion sites. Instruction
handlers expand operations and allocate the scratch locals they need.

Each lowered body records parameters, source locals, and scratch locals in binding order. Operands that require
index assignment stay symbolic so later passes can remap bindings before binary emission.
