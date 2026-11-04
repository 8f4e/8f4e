import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import deriveBlockHighlights from './block-highlights/deriveBlockHighlights';
import deriveCodeBlockCodeCells from './deriveCodeBlockCodeCells';

export const codeRenderingPlugin: EditorPlugin = {
	id: 'code-rendering',
	setup: ({ store, events, drawers }) => {
		const renderingByBlock = new Map<
			CodeBlockGraphicData,
			{ cells: ReturnType<typeof deriveCodeBlockCodeCells>; highlights: ReturnType<typeof deriveBlockHighlights> }
		>();
		const refresh = () => {
			renderingByBlock.clear();
			const state = store.getState();
			for (const block of state.codeBlockRendering.currentProject.blocks) {
				renderingByBlock.set(block, {
					cells: deriveCodeBlockCodeCells(block),
					highlights: deriveBlockHighlights(block, state.viewport),
				});
			}
		};
		events.on('codeBlockLayoutsChanged', refresh);
		refresh();
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
			const rendering = renderingByBlock.get(codeBlock)!;
			if (!codeBlock.disabled) {
				for (const { x, y, width, height, color } of rendering.highlights) draw.drawFill(x, y, color, width, height);
			}
			if (state.featureFlags.codeLineSelection && state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				draw.drawFill(0, codeBlock.cursor.y, PALETTE_INDICES.primarySoft, codeBlock.width, state.viewport.hGrid);
			}
			const rows = rendering.cells;
			for (let row = 0; row < rows.length; row++) {
				draw.drawResolvedText(state.viewport.vGrid, state.viewport.hGrid * row, rows[row]);
			}
		});
		return () => {
			events.off('codeBlockLayoutsChanged', refresh);
			unregisterDrawer();
			renderingByBlock.clear();
		};
	},
};
