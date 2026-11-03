import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import deriveCodeBlockCodeCells from './deriveCodeBlockCodeCells';

export const codeRenderingPlugin: EditorPlugin = {
	id: 'code-rendering',
	setup: ({ store, events, drawers }) => {
		const cellsByBlock = new Map<CodeBlockGraphicData, ReturnType<typeof deriveCodeBlockCodeCells>>();
		const refresh = () => {
			cellsByBlock.clear();
			for (const block of store.getState().codeBlockRendering.currentProject.blocks) {
				cellsByBlock.set(block, deriveCodeBlockCodeCells(block));
			}
		};
		events.on('codeBlockLayoutsChanged', refresh);
		refresh();
		const unregisterDrawer = drawers.registerCodeBlockContentDrawer(({ draw, state, codeBlock }) => {
			const rows = cellsByBlock.get(codeBlock)!;
			for (let row = 0; row < rows.length; row++) {
				draw.drawResolvedText(state.viewport.vGrid, state.viewport.hGrid * row, rows[row]);
			}
		});
		return () => {
			events.off('codeBlockLayoutsChanged', refresh);
			unregisterDrawer();
			cellsByBlock.clear();
		};
	},
};
