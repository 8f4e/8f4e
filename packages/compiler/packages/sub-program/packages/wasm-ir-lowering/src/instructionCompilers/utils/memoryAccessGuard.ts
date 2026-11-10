import {
	WASM_I32_ADD,
	WASM_I32_AND,
	WASM_I32_LE_U,
	WASM_I32_SHL,
	WASM_I32_SUB,
	WASM_MEMORY_PAGE_SIZE,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	type WASM_TYPE_I32,
	WASM_TYPE_VOID,
} from '@8f4e/compiler-wasm-utils';
import {
	type CodegenContext,
	functionValueTypeToLocalMetadata,
	wasmLocalGet as localGet,
	wasmLocalSet as localSet,
	type StackItem,
	type WasmIRInstruction,
} from '@8f4e/language-spec';
import { allocateLocal } from '../../localStorage';
import { f32const, f64const, i32const, ifelse, memoryCopy } from '../../operations';

type NumericWasmValueType = typeof WASM_TYPE_I32 | typeof WASM_TYPE_F32 | typeof WASM_TYPE_F64;

type GuardedLoadOptions = {
	accessByteWidth: number;
	resultType: NumericWasmValueType;
	loadByteCode: WasmIRInstruction[];
};

type GuardedStoreOptions = {
	value: StackItem;
	accessByteWidth: number;
	storeByteCode: WasmIRInstruction[];
};

/**
 * Returns whether stack analysis proves an address can safely access the requested byte width.
 *
 * @param address - Resolved address metadata to inspect.
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @returns Whether the check succeeds.
 */
export function isSafeMemoryAccess(address: StackItem, accessByteWidth: number): boolean {
	if (address.kind !== 'address') {
		return false;
	}

	return (
		(address.address.safeRange?.safeByteLength ?? 0) >= accessByteWidth ||
		(address.address.safeAccessByteWidth ?? 0) >= accessByteWidth
	);
}

/**
 * Builds bytecode for the last valid start address for an access width in a linear memory.
 *
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @returns The computed result.
 */
export function linearLastValidStartAddress(accessByteWidth: number): WasmIRInstruction[] {
	return [
		{ kind: 'memory.size' },
		...i32const(1),
		WASM_I32_SUB,
		...i32const(16),
		WASM_I32_SHL,
		...i32const(WASM_MEMORY_PAGE_SIZE - accessByteWidth),
		WASM_I32_ADD,
	];
}

function linearMemoryByteLength(): WasmIRInstruction[] {
	return [{ kind: 'memory.size' }, ...i32const(16), WASM_I32_SHL];
}

function addressWithinMemoryBounds(addressLocalIndex: number, accessByteWidth: number): WasmIRInstruction[] {
	return [...localGet(addressLocalIndex), ...linearLastValidStartAddress(accessByteWidth), WASM_I32_LE_U];
}

function rangeWithinMemoryBounds(addressLocalIndex: number, byteLength: number): WasmIRInstruction[] {
	return [
		...localGet(addressLocalIndex),
		...linearMemoryByteLength(),
		WASM_I32_LE_U,
		...i32const(byteLength),
		...linearMemoryByteLength(),
		...localGet(addressLocalIndex),
		WASM_I32_SUB,
		WASM_I32_LE_U,
		WASM_I32_AND,
	];
}

function zeroValue(type: NumericWasmValueType): WasmIRInstruction[] {
	if (type === WASM_TYPE_F64) {
		return f64const(0);
	}

	return type === WASM_TYPE_F32 ? f32const(0) : i32const(0);
}

/**
 * Builds a guarded load that returns a zero value when the address is out of bounds.
 *
 * @param context - Compilation context used by the operation.
 * @param options - Compiler options for this compilation pass.
 * @returns The computed result.
 */
export function guardedLoad(context: CodegenContext, options: GuardedLoadOptions): WasmIRInstruction[] {
	const index = allocateLocal(context, { isInteger: true });
	return guardedLoadWithLocal(index, options);
}

/** Builds a guarded load using a caller-provided scratch slot for the stack address. */
export function guardedLoadWithLocal(
	addressLocalIndex: number,
	{ accessByteWidth, resultType, loadByteCode }: GuardedLoadOptions
): WasmIRInstruction[] {
	return [
		...localSet(addressLocalIndex),
		...addressWithinMemoryBounds(addressLocalIndex, accessByteWidth),
		...ifelse(resultType, [...localGet(addressLocalIndex), ...loadByteCode], zeroValue(resultType)),
	];
}

/**
 * Builds a guarded store that skips writing when the address is out of bounds.
 *
 * @param context - Compilation context used by the operation.
 * @param options - Compiler options for this compilation pass.
 * @returns The computed result.
 */
export function guardedStore(context: CodegenContext, options: GuardedStoreOptions): WasmIRInstruction[] {
	const addressLocalIndex = allocateLocal(context, { isInteger: true });
	const valueLocalIndex = allocateLocal(context, functionValueTypeToLocalMetadata(options.value.valueType));

	return [
		...localSet(valueLocalIndex),
		...localSet(addressLocalIndex),
		...guardedStoreFromLocals(addressLocalIndex, valueLocalIndex, options.accessByteWidth, options.storeByteCode),
	];
}

/**
 * Returns whether stack analysis proves both memory-copy ranges are in bounds.
 *
 * @param destination - Destination address metadata for the memory copy.
 * @param source - Source address metadata for the memory copy.
 * @param byteLength - Number of bytes to materialize or validate.
 * @returns Whether the check succeeds.
 */
export function isSafeMemoryCopy(destination: StackItem, source: StackItem, byteLength: number): boolean {
	return byteLength > 0 && isSafeMemoryAccess(destination, byteLength) && isSafeMemoryAccess(source, byteLength);
}

/**
 * Builds a guarded memory.copy that skips copying when either range is out of bounds.
 *
 * @param context - Compilation context used by the operation.
 * @param byteLength - Number of bytes to copy.
 * @returns The computed result.
 */
export function guardedMemoryCopy(context: CodegenContext, byteLength: number): WasmIRInstruction[] {
	const destinationLocalIndex = allocateLocal(context, { isInteger: true });
	const sourceLocalIndex = allocateLocal(context, { isInteger: true });

	return [
		...localSet(sourceLocalIndex),
		...localSet(destinationLocalIndex),
		...rangeWithinMemoryBounds(destinationLocalIndex, byteLength),
		...rangeWithinMemoryBounds(sourceLocalIndex, byteLength),
		WASM_I32_AND,
		...ifelse(WASM_TYPE_VOID, [
			...localGet(destinationLocalIndex),
			...localGet(sourceLocalIndex),
			...i32const(byteLength),
			...memoryCopy(),
		]),
	];
}

/**
 * Builds a guarded store using address and value locals already populated by surrounding bytecode.
 *
 * @param addressLocalIndex - Local index holding the guarded destination address.
 * @param valueLocalIndex - Local index holding the guarded value to store.
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @param storeByteCode - store byte code value to use.
 * @returns The computed result.
 */
export function guardedStoreFromLocals(
	addressLocalIndex: number,
	valueLocalIndex: number,
	accessByteWidth: number,
	storeByteCode: WasmIRInstruction[]
): WasmIRInstruction[] {
	return [
		...addressWithinMemoryBounds(addressLocalIndex, accessByteWidth),
		...ifelse(WASM_TYPE_VOID, [...localGet(addressLocalIndex), ...localGet(valueLocalIndex), ...storeByteCode]),
	];
}
