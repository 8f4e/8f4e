import type { MemoryIdentifier, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration, PlannedMemoryModule } from '@8f4e/language-spec';
import resolveMemoryTarget, { type MemoryScope, type ResolvedMemoryTarget } from './resolveMemoryTarget';

type MemoryPlanLookup = State['compiler']['result']['memoryPlan'];

interface CachedDeclarationsByByteAddress {
	moduleList: readonly PlannedMemoryModule[];
	declarationsByByteAddress: Map<number, PlannedMemoryDeclaration>;
}

const declarationsByByteAddressCache = new WeakMap<MemoryPlanLookup, CachedDeclarationsByByteAddress>();

export function getDeclarationsByByteAddress(
	memoryPlan: MemoryPlanLookup | undefined
): Map<number, PlannedMemoryDeclaration> | undefined {
	if (!memoryPlan) {
		return undefined;
	}

	const { moduleList } = memoryPlan;
	const cached = declarationsByByteAddressCache.get(memoryPlan);
	if (cached && cached.moduleList === moduleList) {
		return cached.declarationsByByteAddress;
	}

	const declarationsByByteAddress = new Map<number, PlannedMemoryDeclaration>();
	for (const module of moduleList) {
		for (const declaration of module.declarations) {
			if (!declarationsByByteAddress.has(declaration.byteAddress)) {
				declarationsByByteAddress.set(declaration.byteAddress, declaration);
			}
		}
	}

	declarationsByByteAddressCache.set(memoryPlan, {
		moduleList,
		declarationsByByteAddress,
	});

	return declarationsByByteAddress;
}

export interface MemoryAccessOptions {
	showAddress?: boolean;
	dereference?: boolean;
	bufferPointer?: number;
}

/** A name and its access operators resolved against the accepted compiler metadata, without reading runtime memory. */
export interface PreparedMemoryAccess {
	target: ResolvedMemoryTarget;
	options: MemoryAccessOptions;
}

/** Resolved storage and access flags, retaining the source target even when a pointer selects different storage. */
export interface ResolvedMemoryAccess extends MemoryIdentifier {
	target: ResolvedMemoryTarget;
}

/** Resolves an access to allocated memory or a fixed reference's backing declaration. */
export function resolveMemoryAccess(
	state: State,
	target: ResolvedMemoryTarget,
	{ showAddress = false, dereference = false, bufferPointer = 0 }: MemoryAccessOptions = {}
): ResolvedMemoryAccess | undefined {
	const { memory, reference } = target;
	if (reference) {
		// A bare fixed reference is its target address; * reads the target without a runtime pointer load.
		if (showAddress) return;
		return { showAddress: !dereference, memory, bufferPointer, target };
	}

	if (dereference && memory.pointeeBaseType) {
		const pointerAddress = state.callbacks?.getWordFromMemory?.(memory.allocationUnitAddress) || 0;
		const pointee = getDeclarationsByByteAddress(state.compiler.result.memoryPlan)?.get(pointerAddress);
		return pointee && { showAddress, memory: pointee, bufferPointer, target };
	}

	return { showAddress, memory, bufferPointer, target };
}

/** Parses an access and resolves its declaration once; prepare again when compiler metadata or source changes. */
export function prepareMemoryAccess(
	state: Pick<State, 'compiler'>,
	scope: MemoryScope,
	memoryIdentifier: string | undefined
): PreparedMemoryAccess | undefined {
	if (!memoryIdentifier) {
		return;
	}

	let showAddress = false;
	let operator: '&' | '*' | undefined;
	let bufferPointer = 0;

	if (memoryIdentifier.startsWith('&')) {
		operator = '&';
		showAddress = true;
		memoryIdentifier = memoryIdentifier.substring(1);
	}

	if (memoryIdentifier.startsWith('*')) {
		operator = '*';
		memoryIdentifier = memoryIdentifier.substring(1);
	}

	if (/.+\[(\d+)\]/.test(memoryIdentifier)) {
		const match = memoryIdentifier.match(/.+\[(\d+)\]/) as [never, string];
		bufferPointer = parseInt(match[1], 10);
		memoryIdentifier = memoryIdentifier.replace(/\[\d+\]/, '');
	}

	const target = resolveMemoryTarget(state, scope, memoryIdentifier);
	if (!target) return;
	return { target, options: { showAddress, dereference: operator === '*', bufferPointer } };
}

/** Resolves a named access, including the current target of a dereferenced runtime pointer. */
export default function resolveMemoryIdentifier(
	state: State,
	scope: MemoryScope,
	memoryIdentifier: string | undefined
): ResolvedMemoryAccess | undefined {
	const prepared = prepareMemoryAccess(state, scope, memoryIdentifier);
	return prepared && resolveMemoryAccess(state, prepared.target, prepared.options);
}

/** Resolves an explicit declaration address or a bare fixed reference for memory controls. */
export function resolveMemoryAddress(
	state: State,
	scope: MemoryScope,
	memoryIdentifier: string | undefined
): ResolvedMemoryAccess | undefined {
	const access = resolveMemoryIdentifier(state, scope, memoryIdentifier);
	return access?.showAddress ? access : undefined;
}
