import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { displayRowToGridRow, getStackOperandProducerRows } from '@8f4e/editor-state';
import type { CodeBlockLayoutsChangedEvent, EditorCodeBlock, State } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

const START = textToGlyphIds('┌');
const JUNCTION = textToGlyphIds('├');
const VERTICAL = textToGlyphIds('│');
const END = textToGlyphIds('└');

function prepareConnection(block: EditorCodeBlock, state: State): Array<{ y: number; glyphs: GlyphIds }> {
	const displayRow = block.displayModel.sourceLineIndexToDisplayRow[block.cursor.row];
	if (displayRow === undefined) return [];
	const producers = new Set(getStackOperandProducerRows(block, state));
	if (!producers.size) return [];

	const startRow = Math.min(...producers);
	const targetRow = displayRowToGridRow(displayRow, block.gaps);
	const rows = [];
	for (let row = startRow; row <= targetRow; row++) {
		let glyphs = VERTICAL;
		if (row === startRow) glyphs = START;
		else if (row === targetRow) glyphs = END;
		else if (producers.has(row)) glyphs = JUNCTION;
		rows.push({ y: row * state.viewport.hGrid, glyphs });
	}
	return rows;
}

/** Draws immediate stack operand connections just outside the selected code block's left edge. */
export const stackConnectionsPlugin: EditorPlugin = {
	id: 'stack-connections',
	setup: ({ store, events, renderRegistry }) => {
		const state = store.getState();
		let selectedBlock: EditorCodeBlock | undefined;
		let rows: ReturnType<typeof prepareConnection> = [];
		const refresh = () => {
			selectedBlock = state.project.selectedCodeBlock;
			rows = selectedBlock ? prepareConnection(selectedBlock, state) : [];
		};
		const selectors = ['project.selectedCodeBlock.cursor.row', 'compiler.result', 'compilerInputRevision'] as const;
		for (const selector of selectors) store.subscribe(selector, refresh);
		const onLayoutsChanged = ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
			if (selectedBlock && codeBlocks.includes(selectedBlock)) refresh();
		};
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);
		const unregister = renderRegistry.registerCanvasBackgroundDrawer(({ draw, viewport, blockPositions }) => {
			if (!selectedBlock || !rows.length) return;
			const renderedBlock = blockPositions.byCodeBlock.get(selectedBlock);
			if (!renderedBlock) return;
			const left = renderedBlock.x;
			const x = left - viewport.vGrid;
			if (left <= 0 || x >= viewport.width) return;
			const top = renderedBlock.y;
			for (const { y, glyphs } of rows) {
				const screenY = top + y;
				if (screenY >= viewport.height) break;
				if (screenY + viewport.hGrid > 0) draw.drawGlyphs(x, screenY, glyphs, PALETTE_INDICES.secondaryReadable);
			}
		});
		refresh();
		return () => {
			for (const selector of selectors) store.unsubscribe(selector, refresh);
			events.off('codeBlockLayoutsChanged', onLayoutsChanged);
			unregister();
		};
	},
};
