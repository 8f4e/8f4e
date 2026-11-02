import {
	f32const,
	f32load,
	f64const,
	f64load,
	i32const,
	i32load,
	i32load8s,
	i32load8u,
	i32load16s,
	i32load16u,
	localGet,
} from '@8f4e/compiler-wasm-utils';
import type { CodegenContext, PointerMetadata } from '@8f4e/language-spec';
import {
	getDereferencedValueKindFromMetadata,
	getDereferencedValueWordSizeFromMetadata,
	getPointerDepthFromMetadata,
	WORD_MEMORY_ACCESS_WIDTH,
} from '@8f4e/language-spec';
import { type PushValueKind, valueKindToWasmType } from '../../pushValueKind';
import { guardedAddressOperation } from '../utils/memoryAccessGuard';

type PointerValueSource = 'pointer-slot' | 'pointer-value' | 'fixed-reference';
type PointerLoadStep = { accessByteWidth: number; loadByteCode: number[] };

export { kindToStackItem, resolveArgumentValueKind, resolveMemoryValueKind } from '../../pushValueKind';

/** Numeric constant emitters keyed by resolved value kind. */
export const constOpcode: Record<PushValueKind, (value: number) => number[]> = {
	int32: i32const,
	float32: f32const,
	float64: f64const,
};

/** Memory load bytecode keyed by resolved value kind. */
export const loadOpcode: Record<PushValueKind, number[]> = {
	int32: i32load(2, 0),
	float32: f32load(2, 0),
	float64: f64load(3, 0),
};

function buildGuardedPointerLoadChain(
	context: CodegenContext,
	lineNumber: number,
	kind: PushValueKind,
	steps: PointerLoadStep[]
): number[] {
	const resultType = valueKindToWasmType(kind);

	return steps.reduceRight<number[]>(
		(continuation, step) =>
			guardedAddressOperation(context, {
				accessByteWidth: step.accessByteWidth,
				lineNumber,
				resultType,
				buildTrueBranch: addressLocalIndex => [...localGet(addressLocalIndex), ...step.loadByteCode, ...continuation],
			}),
		[]
	);
}

function getFinalDereferenceLoad(
	pointerMetadata: PointerMetadata,
	kind: PushValueKind,
	dereferencedValueWordSize: number
): number[] {
	if (pointerMetadata.pointeeBaseType === 'int8u') {
		return i32load8u(0, 0);
	}

	if (pointerMetadata.pointeeBaseType === 'int16u') {
		return i32load16u(1, 0);
	}

	if (dereferencedValueWordSize === 1) {
		return i32load8s(0, 0);
	}

	if (dereferencedValueWordSize === 2) {
		return i32load16s(1, 0);
	}

	return loadOpcode[kind];
}

/**
 * Builds bytecode for loading through a pointer with optional guarded access checks.
 *
 * @param context - Compilation context used by the operation.
 * @param lineNumber - Source line number used for generated guard diagnostics.
 * @param pointerMetadata - Pointer metadata to inspect.
 * @param baseAddressByteCode - Bytecode that leaves the base pointer address on the stack.
 * @param pointerValueSource - Source of the pointer value being dereferenced.
 * @param dereferenceDepth - Pointer dereference depth requested by the instruction.
 * @returns The computed result.
 */
export function buildPointerDereferenceByteCode(
	context: CodegenContext,
	lineNumber: number,
	pointerMetadata: PointerMetadata,
	baseAddressByteCode: number[],
	pointerValueSource: PointerValueSource,
	dereferenceDepth: number
): { kind: PushValueKind; byteCode: number[] } {
	const declaredPointerDepth = getPointerDepthFromMetadata(pointerMetadata);
	const isFinalDereference = dereferenceDepth === declaredPointerDepth;
	const kind = getDereferencedValueKindFromMetadata(pointerMetadata, dereferenceDepth);
	const dereferencedValueWordSize = getDereferencedValueWordSizeFromMetadata(pointerMetadata, dereferenceDepth);
	const finalLoad = getFinalDereferenceLoad(pointerMetadata, kind, dereferencedValueWordSize);
	if (pointerValueSource === 'fixed-reference') {
		return { kind, byteCode: [...baseAddressByteCode, ...finalLoad] };
	}

	if (pointerValueSource === 'pointer-slot') {
		const pointerLoads = [
			...i32load(2, 0),
			...Array.from({ length: isFinalDereference ? dereferenceDepth - 1 : dereferenceDepth }, () =>
				i32load(2, 0)
			).flat(),
		];

		return { kind, byteCode: [...baseAddressByteCode, ...pointerLoads, ...(isFinalDereference ? finalLoad : [])] };
	}

	const guardedLoadSteps = Array.from({ length: isFinalDereference ? dereferenceDepth - 1 : dereferenceDepth }, () => ({
		accessByteWidth: WORD_MEMORY_ACCESS_WIDTH,
		loadByteCode: i32load(2, 0),
	}));
	if (isFinalDereference) {
		guardedLoadSteps.push({
			accessByteWidth: dereferencedValueWordSize,
			loadByteCode: finalLoad,
		});
	}

	return {
		kind,
		byteCode: [...baseAddressByteCode, ...buildGuardedPointerLoadChain(context, lineNumber, kind, guardedLoadSteps)],
	};
}
