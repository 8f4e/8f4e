import type {
	CompilationContext,
	MemoryLayoutPlan,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
	ResolvedMemoryDeclaration,
} from '@8f4e/language-spec';

/** Creates an empty memory plan for contexts that do not compile module memory. */
export function createEmptyMemoryPlan(): MemoryLayoutPlan {
	return {
		modules: {},
		moduleList: [],
	};
}

function getCurrentPlannedModule(context: CompilationContext): PlannedMemoryModule | undefined {
	return context.currentPlannedModule;
}

function getPlannedMemoryDeclaration(
	context: CompilationContext,
	memoryId: string,
	moduleId = context.namespace.moduleName
): PlannedMemoryDeclaration | undefined {
	const currentModule = getCurrentPlannedModule(context);
	const module = !moduleId || moduleId === currentModule?.id ? currentModule : context.memoryPlan.modules[moduleId];
	return module?.memory[memoryId];
}

/** Returns a resolved memory declaration for the active module, or for a target module namespace. */
export function getResolvedMemoryDeclaration(
	context: CompilationContext,
	memoryId: string,
	moduleId = context.namespace.moduleName
): ResolvedMemoryDeclaration | undefined {
	const declaration = getPlannedMemoryDeclaration(context, memoryId, moduleId);
	if (!declaration) {
		return undefined;
	}

	const resolvedModuleId = moduleId ?? context.currentPlannedModule?.id;
	const metadata = resolvedModuleId ? context.pointerMetadataByModuleId[resolvedModuleId]?.[declaration.id] : undefined;
	return {
		...declaration,
		...(metadata?.pointeeElementCount !== undefined ? { pointeeElementCount: metadata.pointeeElementCount } : {}),
	};
}
