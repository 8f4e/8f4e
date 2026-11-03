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
		const unregisterBackground = drawers.registerCodeBlockBackgroundDrawer(({ draw, codeBlock }) => {
			if (codeBlock.disabled) return;
			for (const { x, y, width, height, color } of renderingByBlock.get(codeBlock)!.highlights) {
				draw.drawFill(x, y, PALETTE_INDICES[color], width, height);
			}
		});
		const unregisterDrawer = drawers.registerCodeBlockContentDrawer(({ draw, state, codeBlock }) => {
			const rows = renderingByBlock.get(codeBlock)!.cells;
			for (let row = 0; row < rows.length; row++) {
				draw.drawResolvedText(state.viewport.vGrid, state.viewport.hGrid * row, rows[row]);
			}
		});
		return () => {
			events.off('codeBlockLayoutsChanged', refresh);
			unregisterBackground();
			unregisterDrawer();
			renderingByBlock.clear();
		};
	},
};
