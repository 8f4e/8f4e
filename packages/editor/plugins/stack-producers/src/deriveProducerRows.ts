import { gapCalculator, getCompiledFunctionForCodeBlock, getCompiledModuleForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/** Resolves immediate producers into visible pixel rows using the selected block's settled display geometry. */
export function deriveProducerRows(block: CodeBlockGraphicData, state: State): number[] {
	if (
		!state.featureFlags.codeLineSelection ||
		block.disabled ||
		state.compiler.resultInputRevision !== state.compilerInputRevision
	)
		return [];
	const source = state.compiler.resultSourceCodeByBlockId[block.creationIndex];
	if (!source || source.length !== block.code.length || source.some((line, index) => line !== block.code[index]))
		return [];

	const compilation =
		block.blockType === 'function'
			? getCompiledFunctionForCodeBlock(block, state)
			: getCompiledModuleForCodeBlock(block, state);
	const line = compilation?.stackAnalysis?.find(line => line.lineNumber === block.cursor.row);
	if (!line) return [];

	const rows: number[] = [];
	for (const producer of new Set(line.consumedOperandProducerLines)) {
		const displayRow = block.displayModel.sourceLineIndexToDisplayRow[producer];
		if (producer !== block.cursor.row && displayRow !== undefined) {
			rows.push(gapCalculator(displayRow, block.gaps) * state.viewport.hGrid);
		}
	}
	return rows;
}
