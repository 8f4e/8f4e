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

/** Resolves an access to allocated memory or a fixed reference's backing declaration. */
export function resolveMemoryAccess(
	state: State,
	target: ResolvedMemoryTarget,
	{ showAddress = false, dereference = false, bufferPointer = 0 }: MemoryAccessOptions = {}
): (MemoryIdentifier & { target: ResolvedMemoryTarget }) | undefined {
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

export default function resolveMemoryIdentifier(
	state: State,
	scope: MemoryScope,
	memoryIdentifier: string | undefined
): (MemoryIdentifier & { target: ResolvedMemoryTarget }) | undefined {
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
	return resolveMemoryAccess(state, target, {
		showAddress,
		dereference: operator === '*',
		bufferPointer,
	});
}

/** Resolves an explicit declaration address or a bare fixed reference for memory controls. */
export function resolveMemoryAddress(
	state: State,
	scope: MemoryScope,
	memoryIdentifier: string | undefined
): (MemoryIdentifier & { target: ResolvedMemoryTarget }) | undefined {
	const access = resolveMemoryIdentifier(state, scope, memoryIdentifier);
	return access?.showAddress ? access : undefined;
}
