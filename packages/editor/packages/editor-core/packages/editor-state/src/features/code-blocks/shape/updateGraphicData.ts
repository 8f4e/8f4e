import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { MemoryDefaults, PlannedMemoryModule } from '@8f4e/language-spec';
import getCodeBlockModuleId from '../../../pureHelpers/getCodeBlockModuleId';
import gapCalculator from '../../code-editing/gapCalculator';
import type { DirectiveDerivedState } from '../features/directives/registry';

function getInheritedDeclarationRowOffsets(plannedModule: PlannedMemoryModule, memoryDefaults: MemoryDefaults) {
	const rowOffsetByLineNumber = new Map<number, number>();

	return Object.values(plannedModule.memory)
		.filter(memory => memoryDefaults[memory.id]!.isInherited === true)
		.map(memory => {
			const rowOffset = (rowOffsetByLineNumber.get(memory.lineNumber) ?? 0) + 1;
			rowOffsetByLineNumber.set(memory.lineNumber, rowOffset);

			return { memory, rowOffset };
		})
		.sort((left, right) => {
			return left.memory.lineNumber - right.memory.lineNumber || left.rowOffset - right.rowOffset;
		});
}

export default function shape(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState
): void {
	graphicData.widgets.shapeDeclarations = [];
	if (graphicData.disabled || graphicData.blockType !== 'module') {
		return;
	}

	const moduleId = getCodeBlockModuleId(graphicData);
	const compiledModule = state.compiler.compiledModules[moduleId];
	const plannedModule = state.compiler.memoryPlan.modules[moduleId];
	if (!compiledModule || compiledModule.ast.type !== 'module') {
		return;
	}

	const memoryDefaults = state.compiler.memoryDefaultsByModuleId[moduleId]!;
	const inheritedDeclarationCountByLineNumber = Object.values(plannedModule!.memory).reduce<Map<number, number>>(
		(result, memory) => {
			if (memoryDefaults[memory.id]!.isInherited === true) {
				result.set(memory.lineNumber, (result.get(memory.lineNumber) ?? 0) + 1);
			}
			return result;
		},
		new Map()
	);

	compiledModule.ast.lines.forEach(line => {
		if (line.instruction !== 'shape') {
			return;
		}

		const inheritedDeclarationCount = inheritedDeclarationCountByLineNumber.get(line.lineNumber) ?? 0;
		if (inheritedDeclarationCount === 0) {
			return;
		}

		directiveState.addVerticalSpaceAfterSourceLine({
			sourceLineIndex: line.lineNumber,
			heightInRows: inheritedDeclarationCount,
		});
	});
}

export function updateShapeDeclarations(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState
): void {
	graphicData.widgets.shapeDeclarations = [];
	if (graphicData.disabled || graphicData.blockType !== 'module') {
		return;
	}

	const moduleId = getCodeBlockModuleId(graphicData);
	const compiledModule = state.compiler.compiledModules[moduleId];
	const plannedModule = state.compiler.memoryPlan.modules[moduleId];
	if (!compiledModule || compiledModule.ast.type !== 'module') {
		return;
	}

	const textX = (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	const memoryDefaults = state.compiler.memoryDefaultsByModuleId[moduleId]!;
	for (const { memory, rowOffset } of getInheritedDeclarationRowOffsets(plannedModule!, memoryDefaults)) {
		const displayRow = directiveState.displayModel.sourceLineIndexToDisplayRow[memory.lineNumber];
		if (displayRow === undefined) {
			continue;
		}

		graphicData.widgets.shapeDeclarations.push({
			x: textX,
			y: (gapCalculator(displayRow, graphicData.gaps) + rowOffset) * state.viewport.hGrid,
			text: `${memory.type} ${memory.id}`,
		});
	}
}
