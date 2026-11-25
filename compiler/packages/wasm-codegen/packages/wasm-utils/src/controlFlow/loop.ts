import type { WasmTypeValue } from '../type';

import { WASM_END, WASM_LOOP } from '../wasmInstruction';
import br from './br';

/**
 * Creates a WebAssembly loop structure with automatic back-edge branching.
 *
 * @param resultType - The result type of the loop
 * @param code - Instructions to execute in the loop body
 * @returns Byte array representing the loop-end structure with a branch back to start
 */
export default function loop(resultType: WasmTypeValue, code: number[]): number[] {
	return [WASM_LOOP, resultType, ...code, ...br(0), WASM_END];
}
