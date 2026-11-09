import type { CompiledModuleLookup, MemoryLayoutPlan, PlannedMemoryDeclaration } from '@8f4e/language-spec';

export interface ProgramMemoryStructure {
	compiledModules: CompiledModuleLookup;
	memoryPlan: MemoryLayoutPlan;
}

function didMemoryDeclarationChange(current: PlannedMemoryDeclaration, previous: PlannedMemoryDeclaration): boolean {
	return (
		current.name !== previous.name ||
		current.type !== previous.type ||
		current.numberOfElements !== previous.numberOfElements ||
		current.elementWordSize !== previous.elementWordSize ||
		current.byteAddress !== previous.byteAddress ||
		current.allocationUnitAddress !== previous.allocationUnitAddress ||
		current.allocationUnitCount !== previous.allocationUnitCount ||
		current.isInteger !== previous.isInteger ||
		current.isFloat64 !== previous.isFloat64 ||
		current.pointeeBaseType !== previous.pointeeBaseType ||
		current.pointerDepth !== previous.pointerDepth ||
		current.isUnsigned !== previous.isUnsigned
	);
}

function didMemoryStructureChange(
	current: readonly PlannedMemoryDeclaration[],
	previous: readonly PlannedMemoryDeclaration[]
): boolean {
	return (
		current.length !== previous.length ||
		current.some((declaration, index) => didMemoryDeclarationChange(declaration, previous[index]!))
	);
}

export default function didProgramOrMemoryStructureChange(
	current: ProgramMemoryStructure,
	previous: ProgramMemoryStructure | undefined
) {
	if (!previous) {
		return true;
	}

	const currentKeys = Object.keys(current.compiledModules);
	const previousKeys = Object.keys(previous.compiledModules);

	if (currentKeys.length !== previousKeys.length) {
		return true;
	}

	for (const id of currentKeys) {
		const previousModule = previous.compiledModules[id];
		if (!previousModule) {
			return true;
		}

		const plannedModule = current.memoryPlan.modules[id]!;
		const previousPlannedModule = previous.memoryPlan.modules[id]!;

		if (plannedModule.allocationUnitCount !== previousPlannedModule.allocationUnitCount) {
			return true;
		}

		if (didMemoryStructureChange(plannedModule.declarations, previousPlannedModule.declarations)) {
			return true;
		}
	}

	return false;
}
