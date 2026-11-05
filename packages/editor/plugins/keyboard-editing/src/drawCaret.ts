import type { CodeBlockDrawer, CodeBlockGraphicData } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { getTabStopsByLine, getVisualColumnForRawIndex } from '@8f4e/editor-state';

// Source refresh replaces parsedDirectives even when it updates the code array in place.
const tabLayouts = new WeakMap<
	CodeBlockGraphicData,
	{ code: string[]; directives: CodeBlockGraphicData['parsedDirectives']; stops: number[][] }
>();

const drawCaret: CodeBlockDrawer = ({ draw, state, codeBlock }) => {
	if (state.editorMode !== 'edit' || state.codeBlockRendering.selectedCodeBlock !== codeBlock) return;
	const { row, col, y } = codeBlock.cursor;
	let tabLayout = tabLayouts.get(codeBlock);
	if (tabLayout?.code !== codeBlock.code || tabLayout.directives !== codeBlock.parsedDirectives) {
		tabLayout = {
			code: codeBlock.code,
			directives: codeBlock.parsedDirectives,
			stops: getTabStopsByLine(codeBlock.code),
		};
		tabLayouts.set(codeBlock, tabLayout);
	}
	const tabStops = tabLayout.stops[row] || [];
	const visualColumn = getVisualColumnForRawIndex(codeBlock.code[row] || '', col, tabStops);
	const x = (visualColumn + codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	draw.drawText(x, y, '_', codeBlock.disabled ? PALETTE_INDICES.inkFaint : PALETTE_INDICES.inkBase);
};

export default drawCaret;
