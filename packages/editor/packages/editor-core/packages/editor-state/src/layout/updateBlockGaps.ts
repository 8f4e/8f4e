import type { EditorCodeBlock, VerticalSpaceAfterSourceLine } from '@8f4e/editor-state-types';

export default function updateBlockGaps(block: EditorCodeBlock, spaces: readonly VerticalSpaceAfterSourceLine[]): void {
	block.gaps.clear();

	for (const space of spaces) {
		const displayRow = block.displayModel.sourceLineIndexToDisplayRow[space.sourceLineIndex];
		if (displayRow !== undefined) {
			const existing = block.gaps.get(displayRow);
			block.gaps.set(displayRow, { size: (existing?.size ?? 0) + space.heightInRows });
		}
	}
}
