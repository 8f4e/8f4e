import type { PlannedMemoryDeclaration, PlannedMemoryModule } from '@8f4e/language-spec';
import { resolveProjectMemoryAlias } from '@8f4e/language-spec';
import type { MemoryReferenceResolutionContext } from './context';

export type MemoryTargetRequest =
	| { scope: 'local'; targetMemoryId: string }
	| ({ scope: 'intermodule'; targetModuleId: string } & ({ targetMemoryId: string } | { targetMemoryIndex: number }));

export interface ResolvedMemoryTarget {
	targetModule: PlannedMemoryModule;
	targetMemory: PlannedMemoryDeclaration;
}

/** Resolves a module name or the current-module alias against the completed memory plan. */
export function resolveModuleTarget(
	context: MemoryReferenceResolutionContext,
	moduleId?: string
): PlannedMemoryModule | undefined {
	if (!moduleId || moduleId === 'this') {
		return context.currentModule ?? (context.moduleName ? context.memoryPlan.modules[context.moduleName] : undefined);
	}
	return context.memoryPlan.modules[moduleId];
}

/** Resolves parsed named or indexed selectors to their canonical backing module and declaration. */
export function resolveMemoryTarget(
	request: MemoryTargetRequest,
	context: MemoryReferenceResolutionContext
): ResolvedMemoryTarget | undefined {
	const target =
		request.scope === 'intermodule' && 'targetMemoryId' in request
			? {
					...request,
					...resolveProjectMemoryAlias(context.memoryAliases, request.targetModuleId, request.targetMemoryId),
				}
			: request;
	const targetModule = resolveModuleTarget(context, target.scope === 'intermodule' ? target.targetModuleId : undefined);
	if (!targetModule) return undefined;
	const targetMemory =
		'targetMemoryIndex' in target
			? targetModule.declarations[target.targetMemoryIndex]
			: targetModule.memory[target.targetMemoryId];
	return targetMemory ? { targetModule, targetMemory } : undefined;
}
