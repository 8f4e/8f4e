import { gapCalculator, getCurrentCompiledLineForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/** Resolves immediate producers into visible pixel rows using the selected block's settled display geometry. */
export function deriveProducerRows(block: CodeBlockGraphicData, state: State): number[] {
	if (!state.featureFlags.codeLineSelection || block.disabled) return [];
	const line = getCurrentCompiledLineForCodeBlock(block, state);
	if (!line?.stackAnalysisLine) return [];
	const rows: number[] = [];
	for (const producer of new Set(line.stackAnalysisLine.consumedOperandProducerLines)) {
		const displayRow = block.displayModel.sourceLineIndexToDisplayRow[producer];
		if (producer !== block.cursor.row && displayRow !== undefined) {
			rows.push(gapCalculator(displayRow, block.gaps) * state.viewport.hGrid);
		}
	}
	return rows;
}
