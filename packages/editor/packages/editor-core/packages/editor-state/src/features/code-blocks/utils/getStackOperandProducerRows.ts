import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import gapCalculator from '../../text-geometry/gapCalculator';
import { getCurrentCompiledLineForCodeBlock } from './getCurrentCompiledLineForCodeBlock';

/** Returns distinct physical rows for the current instruction's immediate operand producers, including display gaps. */
export function getStackOperandProducerRows(block: CodeBlockGraphicData, state: State): number[] {
	if (!state.featureFlags.codeLineSelection || block.disabled) return [];
	const line = getCurrentCompiledLineForCodeBlock(block, state);
	if (!line?.stackAnalysisLine) return [];
	const rows: number[] = [];
	for (const producer of new Set(line.stackAnalysisLine.consumedOperandProducerLines)) {
		const displayRow = block.displayModel.sourceLineIndexToDisplayRow[producer];
		if (producer !== block.cursor.row && displayRow !== undefined) {
			rows.push(gapCalculator(displayRow, block.gaps));
		}
	}
	return rows;
}
