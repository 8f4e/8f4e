import { i32const, WASM_I32_GT_U, WASM_I32_LT_S, WASM_SELECT } from '@8f4e/compiler-wasm-utils';
import type { CodegenContext, MemoryAddressRange, WasmIRInstruction } from '@8f4e/language-spec';
import { wasmLocalGet as localGet, wasmLocalSet as localSet } from '@8f4e/language-spec';
import { allocateLocal } from '../../localStorage';

/**
 * Builds bytecode that clamps the top stack address between lower and upper bounds.
 *
 * @param context - Compilation context used by the operation.
 * @param lowerByteAddress - Inclusive lower byte address for the clamp range.
 * @param upperByteAddressCode - Bytecode that leaves the inclusive upper byte address on the stack.
 * @returns The computed result.
 */
export function clampAddressByteCode(
	context: CodegenContext,
	lowerByteAddress: number,
	upperByteAddressCode: number[]
): WasmIRInstruction[] {
	const addressLocalIndex = allocateLocal(context, { isInteger: true });

	return [
		...localSet(addressLocalIndex),
		...i32const(lowerByteAddress),
		...localGet(addressLocalIndex),
		...localGet(addressLocalIndex),
		...i32const(lowerByteAddress),
		WASM_I32_LT_S,
		WASM_SELECT,
		...localSet(addressLocalIndex),
		...upperByteAddressCode,
		...localGet(addressLocalIndex),
		...localGet(addressLocalIndex),
		...upperByteAddressCode,
		WASM_I32_GT_U,
		WASM_SELECT,
	];
}

/**
 * Builds bytecode for the last valid starting byte address in a memory range.
 *
 * @param range - Optional safe memory range to preserve on the produced address.
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @returns The computed result.
 */
export function rangeUpperByteAddressCode(range: MemoryAddressRange, accessByteWidth: number): number[] {
	return i32const(range.byteAddress + Math.max(0, range.safeByteLength - accessByteWidth));
}
