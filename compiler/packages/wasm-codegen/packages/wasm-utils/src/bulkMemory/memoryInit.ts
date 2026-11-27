import prefixedInstruction from '../encoding/prefixedInstruction';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_MISC } from '../wasmInstruction';
import { WASM_MISC_MEMORY_INIT } from '../wasmMiscInstruction';

/** Creates a WebAssembly memory.init instruction. Stack: destination offset, source data offset, byte count. */
export default function memoryInit(dataSegmentIndex = 0): number[] {
	return [...prefixedInstruction(WASM_MISC, WASM_MISC_MEMORY_INIT), ...unsignedLEB128(dataSegmentIndex), 0];
}
