import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import type { BlockLayoutDraft } from './blockLayoutDraft';

function getDisplayRow(sourceLineIndex: number, blockLayout: BlockLayoutDraft): number | undefined {
	return blockLayout.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex];
}

function addGap(editorBlock: EditorCodeBlock, displayRow: number, size: number): void {
	const existing = editorBlock.gaps.get(displayRow);
	editorBlock.gaps.set(displayRow, { size: (existing?.size ?? 0) + size });
}

export default function updateBlockGaps(editorBlock: EditorCodeBlock, blockLayout: BlockLayoutDraft) {
	editorBlock.gaps.clear();

	blockLayout.verticalSpaceAfterSourceLine.forEach(space => {
		const displayRow = getDisplayRow(space.sourceLineIndex, blockLayout);
		if (displayRow !== undefined) {
			addGap(editorBlock, displayRow, space.heightInRows);
		}
	});
}
