import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator, getStackOperandProducerRows } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutsChangedEvent, State } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

const START = textToGlyphIds('┌');
const JUNCTION = textToGlyphIds('├');
const VERTICAL = textToGlyphIds('│');
const END = textToGlyphIds('└');

function prepareConnection(block: CodeBlockGraphicData, state: State): Array<{ y: number; glyphs: GlyphIds }> {
	const displayRow = block.displayModel.sourceLineIndexToDisplayRow[block.cursor.row];
	if (displayRow === undefined) return [];
	const producers = new Set(getStackOperandProducerRows(block, state));
	if (!producers.size) return [];

	const startRow = Math.min(...producers);
	const targetRow = gapCalculator(displayRow, block.gaps);
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

/** Draws immediate stack operand connections in the selected code block's left gutter. */
export const stackConnectionsPlugin: EditorPlugin = {
	id: 'stack-connections',
	setup: ({ store, events, drawers }) => {
		const state = store.getState();
		let selectedBlock: CodeBlockGraphicData | undefined;
		let rows: ReturnType<typeof prepareConnection> = [];
		const refresh = () => {
			selectedBlock = state.codeBlockRendering.selectedCodeBlock;
			rows = selectedBlock ? prepareConnection(selectedBlock, state) : [];
		};
		const selectors = [
			'codeBlockRendering.selectedCodeBlock.cursor.row',
			'compiler.result',
			'compilerInputRevision',
			'featureFlags.codeLineSelection',
		] as const;
		for (const selector of selectors) store.subscribe(selector, refresh);
		const onLayoutsChanged = ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
			if (selectedBlock && codeBlocks.includes(selectedBlock)) refresh();
		};
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);
		const unregister = drawers.registerCodeBlockDrawer(({ draw, codeBlock }) => {
			if (codeBlock !== selectedBlock) return;
			for (const { y, glyphs } of rows) draw.drawGlyphs(0, y, glyphs, PALETTE_INDICES.secondaryReadable);
		});
		refresh();
		return () => {
			for (const selector of selectors) store.unsubscribe(selector, refresh);
			events.off('codeBlockLayoutsChanged', onLayoutsChanged);
			unregister();
		};
	},
};
