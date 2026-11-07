import { f32const, f64const, i32const, i32load, localGet } from '@8f4e/compiler-wasm-utils';
import type { CodegenContext, PointerMetadata } from '@8f4e/language-spec';
import {
	getDereferencedValueKindFromMetadata,
	getDereferencedValueWordSizeFromMetadata,
	getPointerDepthFromMetadata,
	WORD_MEMORY_ACCESS_WIDTH,
} from '@8f4e/language-spec';
import { type PushValueKind, valueKindToWasmType } from '../../pushValueKind';
import { allocateMemoryGuardLocal, guardedAddressOperation } from '../utils/memoryAccessGuard';
import { typedLoad } from './typedLoad';

type PointerValueSource = 'pointer-slot' | 'pointer-value';
type PointerLoadStep = { accessByteWidth: number; loadByteCode: number[] };

export { kindToStackItem, resolveArgumentValueKind, resolveMemoryValueKind } from '../../pushValueKind';
export { loadOpcode } from './typedLoad';

/** Numeric constant emitters keyed by resolved value kind. */
export const constOpcode: Record<PushValueKind, (value: number) => number[]> = {
	int32: i32const,
	float32: f32const,
	float64: f64const,
};

function buildGuardedPointerLoadChain(
	context: CodegenContext,
	kind: PushValueKind,
	steps: PointerLoadStep[]
): number[] {
	const resultType = valueKindToWasmType(kind);
	const addressLocal = allocateMemoryGuardLocal(context, { valueType: 'int' });

	return steps.reduceRight<number[]>(
		(continuation, step) =>
			guardedAddressOperation(context, {
				accessByteWidth: step.accessByteWidth,
				addressLocal,
				resultType,
				buildTrueBranch: addressLocalIndex => [...localGet(addressLocalIndex), ...step.loadByteCode, ...continuation],
			}),
		[]
	);
}

/**
 * Builds bytecode for loading through a pointer with optional guarded access checks.
 *
 * @param context - Compilation context used by the operation.
 * @param pointerMetadata - Pointer metadata to inspect.
 * @param baseAddressByteCode - Bytecode that leaves the base pointer address on the stack.
 * @param pointerValueSource - Source of the pointer value being dereferenced.
 * @param dereferenceDepth - Pointer dereference depth requested by the instruction.
 * @returns The computed result.
 */
export function buildPointerDereferenceByteCode(
	context: CodegenContext,
	pointerMetadata: PointerMetadata,
	baseAddressByteCode: number[],
	pointerValueSource: PointerValueSource,
	dereferenceDepth: number
): { kind: PushValueKind; byteCode: number[] } {
	const declaredPointerDepth = getPointerDepthFromMetadata(pointerMetadata);
	const isFinalDereference = dereferenceDepth === declaredPointerDepth;
	const kind = getDereferencedValueKindFromMetadata(pointerMetadata, dereferenceDepth);
	const dereferencedValueWordSize = getDereferencedValueWordSizeFromMetadata(pointerMetadata, dereferenceDepth);
	const finalLoad = typedLoad(pointerMetadata.pointeeBaseType!);

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
		byteCode: [...baseAddressByteCode, ...buildGuardedPointerLoadChain(context, kind, guardedLoadSteps)],
	};
}
