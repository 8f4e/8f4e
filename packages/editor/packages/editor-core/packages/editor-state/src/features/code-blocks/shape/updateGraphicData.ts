import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { getMemoryDeclarationRows } from '../../../pureHelpers/getMemoryDeclarationRows';
import gapCalculator from '../../code-editing/gapCalculator';
import type { BlockLayoutDraft } from '../layout/types';
import { getModuleCompilationForCodeBlock } from '../utils/getCompiledModuleForCodeBlock';

export default function shape(graphicData: CodeBlockGraphicData, state: State, blockLayout: BlockLayoutDraft): void {
	graphicData.widgets.shapeDeclarations = [];
	if (graphicData.disabled || graphicData.blockType !== 'module') {
		return;
	}

	const compilation = getModuleCompilationForCodeBlock(graphicData, state);
	if (!compilation) {
		return;
	}

	const inheritedDeclarationCountByLineNumber = new Map<number, number>();
	for (const { memory, rowOffset } of getMemoryDeclarationRows(compilation.plannedModule, compilation.memoryDefaults)) {
		if (rowOffset > 0) inheritedDeclarationCountByLineNumber.set(memory.lineNumber, rowOffset);
	}

	compilation.compiledModule.ast.lines.forEach(line => {
		if (line.instruction !== 'shape') {
			return;
		}

		const inheritedDeclarationCount = inheritedDeclarationCountByLineNumber.get(line.lineNumber) ?? 0;
		if (inheritedDeclarationCount === 0) {
			return;
		}

		blockLayout.verticalSpaceAfterSourceLine.push({
			sourceLineIndex: line.lineNumber,
			heightInRows: inheritedDeclarationCount,
		});
	});
}

export function updateShapeDeclarations(
	graphicData: CodeBlockGraphicData,
	state: State,
	blockLayout: BlockLayoutDraft
): void {
	graphicData.widgets.shapeDeclarations = [];
	if (graphicData.disabled || graphicData.blockType !== 'module') {
		return;
	}

	const compilation = getModuleCompilationForCodeBlock(graphicData, state);
	if (!compilation) {
		return;
	}

	const textX = (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	for (const { memory, rowOffset } of getMemoryDeclarationRows(compilation.plannedModule, compilation.memoryDefaults)) {
		if (rowOffset === 0) continue;
		const displayRow = blockLayout.displayModel.sourceLineIndexToDisplayRow[memory.lineNumber];
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
