import prefixedInstruction from '../encoding/prefixedInstruction';
import { WASM_MISC } from '../wasmInstruction';
import { WASM_MISC_MEMORY_COPY } from '../wasmMiscInstruction';

/** Creates a WebAssembly memory.copy instruction. Stack: destination offset, source offset, byte count. */
export default function memoryCopy(): number[] {
	return [...prefixedInstruction(WASM_MISC, WASM_MISC_MEMORY_COPY), 0, 0];
}
