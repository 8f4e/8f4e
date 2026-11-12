import { gapCalculator, getCompiledFunctionForCodeBlock, getCompiledModuleForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/** Aligns unchanged source instructions across comment/blank-line edits without guessing between repeated lines. */
function mapSourceRows(source: readonly string[], current: readonly string[]): Map<number, number> | undefined {
	const isCommentOrBlank = (line: string) => /^\s*(?:;|$)/.test(line);
	const rows = new Map<number, number>();
	let currentRow = 0;
	for (let sourceRow = 0; sourceRow < source.length; sourceRow++) {
		if (isCommentOrBlank(source[sourceRow])) continue;
		while (currentRow < current.length && isCommentOrBlank(current[currentRow])) currentRow++;
		if (source[sourceRow] !== current[currentRow]) return undefined;
		rows.set(sourceRow, currentRow++);
	}
	while (currentRow < current.length && isCommentOrBlank(current[currentRow])) currentRow++;
	return currentRow === current.length ? rows : undefined;
}

/** Resolves immediate producers into visible pixel rows using the selected block's settled display geometry. */
export function deriveProducerRows(block: CodeBlockGraphicData, state: State): number[] {
	if (
		!state.featureFlags.codeLineSelection ||
		block.disabled ||
		state.compiler.resultInputRevision !== state.compilerInputRevision
	)
		return [];
	const source = state.compiler.resultSourceCodeByBlockId[block.creationIndex];
	if (!source) return [];
	const sourceRows = mapSourceRows(source, block.code);
	if (!sourceRows) return [];

	const compilation =
		block.blockType === 'function'
			? getCompiledFunctionForCodeBlock(block, state)
			: getCompiledModuleForCodeBlock(block, state);
	const line = compilation?.stackAnalysis?.find(line => sourceRows.get(line.lineNumber) === block.cursor.row);
	if (!line) return [];

	const rows: number[] = [];
	for (const producer of new Set(line.consumedOperandProducerLines)) {
		const sourceRow = sourceRows.get(producer);
		const displayRow = sourceRow === undefined ? undefined : block.displayModel.sourceLineIndexToDisplayRow[sourceRow];
		if (sourceRow !== block.cursor.row && displayRow !== undefined) {
			rows.push(gapCalculator(displayRow, block.gaps) * state.viewport.hGrid);
		}
	}
	return rows;
}
