import type { CodeBlockDrawer } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

const drawCaret: CodeBlockDrawer = ({ draw, state, codeBlock }) => {
	if (state.editorMode !== 'edit' || state.codeBlockRendering.selectedCodeBlock !== codeBlock) return;
	draw.drawText(
		codeBlock.cursor.x,
		codeBlock.cursor.y,
		'_',
		codeBlock.disabled ? PALETTE_INDICES.inkFaint : PALETTE_INDICES.inkBase
	);
};

export default drawCaret;
