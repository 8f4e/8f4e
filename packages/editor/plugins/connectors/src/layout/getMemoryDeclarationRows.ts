import type { MemoryDefaults, PlannedMemoryDeclaration, PlannedMemoryModule } from '@8f4e/language-spec';

export interface MemoryDeclarationRow {
	memory: PlannedMemoryDeclaration;
	rowOffset: number;
}

/** Orders declarations by source row, placing inherited declarations below their shape instruction. */
export function getMemoryDeclarationRows(
	plannedModule: PlannedMemoryModule,
	memoryDefaults: MemoryDefaults
): MemoryDeclarationRow[] {
	const inheritedRowsByLine = new Map<number, number>();
	return plannedModule.declarations
		.filter(memory => memory.name === undefined || plannedModule.memory[memory.name]?.id === memory.id)
		.map(memory => {
			let rowOffset = 0;
			if (memoryDefaults[memory.id].isInherited === true) {
				rowOffset = (inheritedRowsByLine.get(memory.lineNumber) ?? 0) + 1;
				inheritedRowsByLine.set(memory.lineNumber, rowOffset);
			}
			return { memory, rowOffset };
		})
		.sort((left, right) => left.memory.lineNumber - right.memory.lineNumber || left.rowOffset - right.rowOffset);
}
