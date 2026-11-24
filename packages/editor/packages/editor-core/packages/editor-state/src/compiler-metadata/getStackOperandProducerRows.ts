import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import displayRowToGridRow from '../layout/text-geometry/displayRowToGridRow';
import { getCurrentCompiledLineForCodeBlock } from './getCurrentCompiledLineForCodeBlock';

/** Returns distinct physical rows for the current instruction's immediate operand producers, including display gaps. */
export function getStackOperandProducerRows(block: EditorCodeBlock, state: State): number[] {
	if (block.disabled) return [];
	const line = getCurrentCompiledLineForCodeBlock(block, state);
	if (!line?.stackAnalysisLine) return [];
	const rows: number[] = [];
	for (const producer of new Set(line.stackAnalysisLine.consumedOperandProducerLines)) {
		const displayRow = block.displayModel.sourceLineIndexToDisplayRow[producer];
		if (producer !== block.cursor.row && displayRow !== undefined) {
			rows.push(displayRowToGridRow(displayRow, block.gaps));
		}
	}
	return rows;
}
