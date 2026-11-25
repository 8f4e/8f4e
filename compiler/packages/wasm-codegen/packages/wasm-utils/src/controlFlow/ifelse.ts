import type { WasmTypeValue } from '../type';
import { WASM_ELSE, WASM_END, WASM_IF } from '../wasmInstruction';

/**
 * Creates a WebAssembly if-else-end control flow structure.
 *
 * @param resultType - The result type of the if-else expression
 * @param trueBranch - Instructions to execute if condition is true
 * @param falseBranch - Instructions to execute if condition is false (defaults to empty)
 * @returns Instruction sequence representing the if-else-end structure
 */
export default function ifelse<T>(
	resultType: WasmTypeValue,
	trueBranch: readonly T[],
	falseBranch: readonly T[] = []
): (number | T)[] {
	return [WASM_IF, resultType, ...trueBranch, WASM_ELSE, ...falseBranch, WASM_END];
}
