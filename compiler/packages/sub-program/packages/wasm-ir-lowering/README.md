# @8f4e/wasm-ir-lowering

Lowers a resolved 8f4e program to one Wasm module using the source stack report, assertion plan, entry schedule, and
memory plan. It constructs all function bodies, imports, exports, and passive data segments before optimization.

Bodies describe Wasm operations with explicit operands and locals in binding order. Calls and data references remain
symbolic until binary emission.
