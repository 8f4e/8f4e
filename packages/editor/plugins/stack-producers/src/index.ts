import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { getStackOperandProducerRows } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutsChangedEvent } from '@8f4e/editor-state-types';

/** Highlights the source instructions that immediately produced the selected instruction's stack operands. */
export const stackProducersPlugin: EditorPlugin = {
	id: 'stack-producers',
	setup: ({ store, events, drawers }) => {
		const state = store.getState();
		let selectedBlock: CodeBlockGraphicData | undefined;
		let rows: number[] = [];
		const refresh = () => {
			selectedBlock = state.codeBlockRendering.selectedCodeBlock;
			rows = selectedBlock
				? getStackOperandProducerRows(selectedBlock, state).map(row => row * state.viewport.hGrid)
				: [];
		};
		const selectors = [
			'codeBlockRendering.selectedCodeBlock',
			'compiler.result',
			'compilerInputRevision',
			'featureFlags.codeLineSelection',
		] as const;
		for (const selector of selectors) store.subscribe(selector, refresh);
		const onLayoutsChanged = ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
			if (selectedBlock && codeBlocks.includes(selectedBlock)) refresh();
		};
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);
		const unregister = drawers.registerCodeBlockTextBackgroundDrawer(({ draw, renderedBlock: { codeBlock } }) => {
			if (codeBlock !== selectedBlock) return;
			for (const y of rows) {
				draw.drawFill(0, y, PALETTE_INDICES.secondaryAlpha30, codeBlock.width, state.viewport.hGrid);
			}
		});
		refresh();
		return () => {
			unregister();
			for (const selector of selectors) store.unsubscribe(selector, refresh);
			events.off('codeBlockLayoutsChanged', onLayoutsChanged);
			selectedBlock = undefined;
			rows = [];
		};
	},
};
