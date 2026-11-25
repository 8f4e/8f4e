import {
	getDeclarationsByByteAddress,
	isAddressAccess,
	type MemoryScope,
	prepareAddressBinding,
	prepareMemoryAccess,
	prepareNumericRead,
	type ResolvedMemoryTarget,
	resolveMemoryTarget,
} from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import { createProjectModuleId, type EndAddressIdentifier, getProjectGroupPathFromModuleId } from '@8f4e/language-spec';
import type { WatchDisplay } from '../types';
import type { WatchTarget } from './data';

type CompilerState = Pick<State, 'compiler'>;

function fixedEnd(byteAddress: number): WatchDisplay {
	return { kind: 'address', address: { kind: 'fixed', byteAddress } };
}

function prepareTargetEnd(
	state: CompilerState,
	target: ResolvedMemoryTarget,
	dereference: boolean
): WatchDisplay | undefined {
	if (!dereference) return target.reference ? undefined : fixedEnd(target.memory.endByteAddress);
	if (target.reference) return fixedEnd(target.memory.endByteAddress);
	const address = prepareAddressBinding({ target, options: {} });
	// Debugger-only inspection: resolve a live pointer's current declaration when drawing.
	return address?.kind === 'pointer'
		? { kind: 'endAddress', address, declarations: getDeclarationsByByteAddress(state.compiler.result.memoryPlan)! }
		: undefined;
}

function getQueryModuleId(query: EndAddressIdentifier, scope: MemoryScope): string | undefined {
	if (query.scope === 'local' || query.targetModuleId === 'this')
		return scope.kind === 'module' ? scope.moduleId : undefined;
	const groupPath = scope.kind === 'module' ? getProjectGroupPathFromModuleId(scope.moduleId) : scope.groupPath;
	return query.targetModuleId.includes('/')
		? query.targetModuleId
		: createProjectModuleId(groupPath, query.targetModuleId);
}

function prepareEndQuery(
	state: CompilerState,
	scope: MemoryScope,
	query: EndAddressIdentifier
): WatchDisplay | undefined {
	if (
		query.targetKind === 'module' ||
		(query.scope === 'local' && query.targetKind === 'memory' && query.targetMemoryId === 'this')
	) {
		const moduleId = getQueryModuleId(query, scope);
		const module = moduleId === undefined ? undefined : state.compiler.result.memoryPlan.modules[moduleId];
		return module && fixedEnd(module.endByteAddress);
	}
	if (query.targetKind === 'indexed-memory') {
		const moduleId = getQueryModuleId(query, scope);
		const memory =
			moduleId === undefined
				? undefined
				: state.compiler.result.memoryPlan.modules[moduleId]?.declarations[query.targetMemoryIndex];
		return memory && fixedEnd(memory.endByteAddress);
	}
	const identifier =
		query.scope === 'local' ? query.targetMemoryId : `${getQueryModuleId(query, scope)}:${query.targetMemoryId}`;
	const target = resolveMemoryTarget(state, scope, identifier);
	return target && prepareTargetEnd(state, target, query.targetKind === 'pointee');
}

/** Prepares a parsed watch target once; live pointer inspection follows its current declaration while drawing. */
export function prepareWatchDisplay(
	state: CompilerState,
	scope: MemoryScope,
	target: WatchTarget,
	inlineTarget?: ResolvedMemoryTarget
): WatchDisplay | undefined {
	if (target.kind === 'end') return prepareEndQuery(state, scope, target.query);
	if (target.kind === 'inline-end') return inlineTarget && prepareTargetEnd(state, inlineTarget, target.dereference);
	const access =
		target.kind === 'inline'
			? inlineTarget && { target: inlineTarget, options: target.options }
			: prepareMemoryAccess(state, scope, target.identifier);
	if (!access) return;
	if (isAddressAccess(access)) {
		const address = prepareAddressBinding(access);
		return address && { kind: 'address', address };
	}
	const read = prepareNumericRead(access);
	return read && { kind: 'value', read };
}
