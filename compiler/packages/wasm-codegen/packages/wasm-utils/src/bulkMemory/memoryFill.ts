import prefixedInstruction from '../encoding/prefixedInstruction';
import { WASM_MISC } from '../wasmInstruction';
import { WASM_MISC_MEMORY_FILL } from '../wasmMiscInstruction';

/** Creates a WebAssembly memory.fill instruction. Stack: destination offset, fill byte, byte count. */
export default function memoryFill(): number[] {
	return [...prefixedInstruction(WASM_MISC, WASM_MISC_MEMORY_FILL), 0];
}
