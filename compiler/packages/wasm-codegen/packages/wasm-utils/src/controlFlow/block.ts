import type { WasmTypeValue } from '../type';
import { WASM_BLOCK, WASM_END } from '../wasmInstruction';

/**
 * Creates a WebAssembly block structure.
 *
 * @param resultType - The result type of the block
 * @param code - Instructions to execute in the block
 * @returns Byte array representing the block-end structure
 */
export default function block(resultType: WasmTypeValue, code: number[]): number[] {
	return [WASM_BLOCK, resultType, ...code, WASM_END];
}
