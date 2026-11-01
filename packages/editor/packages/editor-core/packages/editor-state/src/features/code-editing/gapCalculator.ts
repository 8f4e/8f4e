import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

/**
 * Calculates the physical row index by adding the size of every gap that starts before the logical row.
 * Gaps are produced by `features/code-blocks/gaps.ts` to insert additional blank rows after a line
 * whenever a decoration (a plugin visualizer or compilation errors) needs vertical space in the
 * displayed block. Each entry stores how many extra logical layout rows follow that
 * logical line, so downstream consumers must translate logical line numbers into physical rows before
 * turning them into pixel coordinates.
 * @param row Logical row within the editor before accounting for the inserted gap rows.
 * @param gaps Gap metadata keyed by logical row whose size indicates the number of additional rows inserted.
 * @returns The adjusted physical row that includes the cumulative gap offsets.
 */
export default function gapCalculator(row: number, gaps: CodeBlockGraphicData['gaps']) {
	let physicalRowCounter = row;
	for (const [gapStartLine, { size }] of gaps) {
		if (row > gapStartLine) {
			physicalRowCounter += size;
		}
	}
	return physicalRowCounter;
}
