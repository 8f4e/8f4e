import {
	WASM_I32_AND,
	WASM_I32_EQZ,
	WASM_I32_GE_S,
	WASM_I32_LE_U,
	WASM_I32_OR,
	WASM_I32_SUB,
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
 * @param memoryByteLength - Fixed imported memory size, including page padding.
 * @returns Whether the check succeeds.
 */
export function isSafeMemoryAccess(address: StackItem, accessByteWidth: number, memoryByteLength: number): boolean {
	if (accessByteWidth < 0 || accessByteWidth > memoryByteLength) return false;
	if (
		address.kind === 'address' &&
		((address.address.safeRange?.safeByteLength ?? -1) >= accessByteWidth ||
			(address.address.safeAccessByteWidth ?? -1) >= accessByteWidth)
	) {
		return true;
	}
	// An empty range still needs a destination at or before the memory end.
	const byteAddress = address.knownValue === undefined ? undefined : address.knownValue >>> 0;
	return byteAddress !== undefined && byteAddress <= memoryByteLength - accessByteWidth;
}

/**
 * Builds bytecode for the last valid start address for an access width in a linear memory.
 *
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @param memoryByteLength - Fixed imported memory size, including page padding.
 * @returns The computed result.
 */
export function linearLastValidStartAddress(accessByteWidth: number, memoryByteLength: number): WasmIRInstruction[] {
	return i32const(memoryByteLength - accessByteWidth);
}

function addressWithinMemoryBounds(
	context: CodegenContext,
	addressLocalIndex: number,
	accessByteWidth: number
): WasmIRInstruction[] {
	if (accessByteWidth > context.minimumMemoryBytes) return i32const(0);
	return [
		...localGet(addressLocalIndex),
		...linearLastValidStartAddress(accessByteWidth, context.minimumMemoryBytes),
		WASM_I32_LE_U,
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
	return guardedLoadWithLocal(context, index, options);
}

/** Builds a guarded load using a caller-provided scratch slot for the stack address. */
export function guardedLoadWithLocal(
	context: CodegenContext,
	addressLocalIndex: number,
	{ accessByteWidth, resultType, loadByteCode }: GuardedLoadOptions
): WasmIRInstruction[] {
	return [
		...localSet(addressLocalIndex),
		...addressWithinMemoryBounds(context, addressLocalIndex, accessByteWidth),
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
		...guardedStoreFromLocals(
			context,
			addressLocalIndex,
			valueLocalIndex,
			options.accessByteWidth,
			options.storeByteCode
		),
	];
}

/**
 * Builds a copy guard for only the ranges that still need a runtime bounds check.
 *
 * @param context - Compilation context providing the fixed memory size and scratch locals.
 * @param byteLength - Number of bytes to copy.
 * @param safeRanges - Ranges independently proven safe by stack analysis.
 * @returns Guarded copy instructions.
 */
export function guardedMemoryCopy(
	context: CodegenContext,
	byteLength: number,
	safeRanges: { destination: boolean; source: boolean }
): WasmIRInstruction[] {
	const destinationLocalIndex = allocateLocal(context, { isInteger: true });
	const sourceLocalIndex = allocateLocal(context, { isInteger: true });
	const bounds = [
		...(safeRanges.destination ? [] : addressWithinMemoryBounds(context, destinationLocalIndex, byteLength)),
		...(safeRanges.source ? [] : addressWithinMemoryBounds(context, sourceLocalIndex, byteLength)),
		...(!safeRanges.destination && !safeRanges.source ? [WASM_I32_AND] : []),
	];

	return [
		...localSet(sourceLocalIndex),
		...localSet(destinationLocalIndex),
		...bounds,
		...ifelse(WASM_TYPE_VOID, [
			...localGet(destinationLocalIndex),
			...localGet(sourceLocalIndex),
			...i32const(byteLength),
			...memoryCopy(),
		]),
	];
}

/** Builds a guarded memory.fill that skips the entire fill when the byte range is out of bounds. */
export function guardedMemoryFill(context: CodegenContext): WasmIRInstruction[] {
	const destinationLocalIndex = allocateLocal(context, { isInteger: true });
	const valueLocalIndex = allocateLocal(context, { isInteger: true });
	const lengthLocalIndex = allocateLocal(context, { isInteger: true });

	// Above 2 GiB, reject negative i32 counts explicitly. At 4 GiB the
	// memory-size constant wraps to zero, but every i32 address admits an empty fill.
	return [
		...localSet(lengthLocalIndex),
		...localSet(valueLocalIndex),
		...localSet(destinationLocalIndex),
		...localGet(lengthLocalIndex),
		...(context.minimumMemoryBytes >= 0x8000_0000
			? [...i32const(0), WASM_I32_GE_S]
			: [...i32const(context.minimumMemoryBytes), WASM_I32_LE_U]),
		...localGet(destinationLocalIndex),
		...i32const(context.minimumMemoryBytes),
		...localGet(lengthLocalIndex),
		WASM_I32_SUB,
		WASM_I32_LE_U,
		...(context.minimumMemoryBytes === 0x1_0000_0000 ? [...localGet(lengthLocalIndex), WASM_I32_EQZ, WASM_I32_OR] : []),
		WASM_I32_AND,
		...ifelse(WASM_TYPE_VOID, [
			...localGet(destinationLocalIndex),
			...localGet(valueLocalIndex),
			...localGet(lengthLocalIndex),
			{ kind: 'memory.fill' },
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
	context: CodegenContext,
	addressLocalIndex: number,
	valueLocalIndex: number,
	accessByteWidth: number,
	storeByteCode: WasmIRInstruction[]
): WasmIRInstruction[] {
	return [
		...addressWithinMemoryBounds(context, addressLocalIndex, accessByteWidth),
		...ifelse(WASM_TYPE_VOID, [...localGet(addressLocalIndex), ...localGet(valueLocalIndex), ...storeByteCode]),
	];
}
