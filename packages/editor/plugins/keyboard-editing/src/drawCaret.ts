import type { CodeBlockDrawer } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { getTabStopsByLine, getVisualColumnForRawIndex } from '@8f4e/editor-state';
import type { CodeBlockLayoutsChangedEvent, EventDispatcher, State } from '@8f4e/editor-state-types';
import { textToGlyphIds } from '@8f4e/web-ui';

const CARET = textToGlyphIds('_');

export default function createCaretPresentation(state: State, events: EventDispatcher) {
	let x = 0;
	const prepare = () => {
		const block = state.codeBlockRendering.selectedCodeBlock;
		if (!block) return;
		const { row, col } = block.cursor;
		const tabStops = getTabStopsByLine(block.code)[row] || [];
		const visualColumn = getVisualColumnForRawIndex(block.code[row] || '', col, tabStops);
		x = (visualColumn + block.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	};
	const drawCaret: CodeBlockDrawer = ({ draw, codeBlock }) => {
		if (state.editorMode !== 'edit' || state.codeBlockRendering.selectedCodeBlock !== codeBlock) return;
		draw.drawGlyphs(
			x,
			codeBlock.cursor.y,
			CARET,
			codeBlock.disabled ? PALETTE_INDICES.inkFaint : PALETTE_INDICES.inkBase
		);
	};

	const onLayoutsChanged = ({ project, codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		if (project !== state.codeBlockRendering.currentProject) return;
		if (state.codeBlockRendering.selectedCodeBlock && codeBlocks.includes(state.codeBlockRendering.selectedCodeBlock))
			prepare();
	};
	events.on('codeBlockLayoutsChanged', onLayoutsChanged);
	prepare();
	return {
		drawCaret,
		dispose: () => events.off('codeBlockLayoutsChanged', onLayoutsChanged),
	};
}
