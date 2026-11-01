import type { MemoryDefaults, MemoryLayoutPlan, MemoryValueChange } from '@8f4e/language-spec';
import compareObject from './compareObject';

export interface ProgramMemoryDefaults {
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
}

export default function getMemoryValueChanges(
	current: ProgramMemoryDefaults,
	previous: ProgramMemoryDefaults | undefined
): MemoryValueChange[] {
	const changes: MemoryValueChange[] = [];

	if (!previous) {
		return [];
	}

	for (const [id, plannedModule] of Object.entries(current.memoryPlan.modules)) {
		for (const [memoryIdentifier, memory] of Object.entries(plannedModule.memory)) {
			const memoryDefault = current.memoryDefaultsByModuleId[id]![memoryIdentifier]!;
			const previousMemoryDefault = previous.memoryDefaultsByModuleId[id]![memoryIdentifier]!;
			const defaultValue = memoryDefault.value;
			const previousDefaultValue = previousMemoryDefault.value;

			if (typeof defaultValue === 'object' && typeof previousDefaultValue === 'object') {
				if (!compareObject(defaultValue, previousDefaultValue)) {
					changes.push({
						allocationUnitCount: memory.allocationUnitCount,
						allocationUnitAddress: memory.allocationUnitAddress,
						value: defaultValue,
						isInteger: memory.isInteger,
						isFloat64: memory.isFloat64,
						elementWordSize: memory.elementWordSize,
					});
				}
			} else {
				if (previousDefaultValue !== defaultValue) {
					changes.push({
						allocationUnitCount: memory.allocationUnitCount,
						allocationUnitAddress: memory.allocationUnitAddress,
						value: defaultValue,
						isInteger: memory.isInteger,
						isFloat64: memory.isFloat64,
						elementWordSize: memory.elementWordSize,
					});
				}
			}
		}
	}

	return changes;
}
