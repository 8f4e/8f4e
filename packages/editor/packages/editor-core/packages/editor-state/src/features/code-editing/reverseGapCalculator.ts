import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

/**
 * Converts a physical row index (which includes gap rows inserted for decorations) back into a logical row.
 * The `gaps` map stores how many extra rows were spliced after each logical line so visualizers and error
 * callouts have dedicated vertical space; when translating from screen coordinates we need to subtract those
 * offsets to recover the original code line.
 * @param physicalRow Row index taken from rendered grid coordinates.
 * @param gaps Gap metadata keyed by logical row identifying how many physical rows were inserted after it.
 * @returns A non-negative logical row with gap offsets removed.
 */
export default function reverseGapCalculator(physicalRow: number, gaps: CodeBlockGraphicData['gaps']) {
	let startLineOffset = 0;
	for (const [gapStartLine, { size }] of gaps) {
		if (physicalRow > gapStartLine + startLineOffset) {
			startLineOffset += size;
		}
	}

	return Math.max(physicalRow - startLineOffset, 0);
}
