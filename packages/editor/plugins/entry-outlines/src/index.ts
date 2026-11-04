import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { ResolveCodeBlockInsertionEntryEvent } from '@8f4e/editor-state';
import deriveEntryOutlines from './deriveEntryOutlines';

export const entryOutlinesPlugin: EditorPlugin = {
	id: 'entry-outlines',
	setup: ({ store, events, drawers }) => {
		const state = store.getState();
		let outlines: ReturnType<typeof deriveEntryOutlines> = [];
		const updateOutlines = () => {
			outlines = deriveEntryOutlines(
				state.codeBlockRendering.currentProject.blocks,
				state.viewport.vGrid * 8,
				state.viewport.hGrid * 4
			);
		};
		const onInsertionEntry = (request: ResolveCodeBlockInsertionEntryEvent) => {
			const outline = outlines.find(
				({ x, y, width, height }) =>
					request.x >= x && request.x <= x + width && request.y >= y && request.y <= y + height
			);
			if (outline) request.entry = outline.entryName;
		};
		const unregisterDrawer = drawers.registerCanvasBackgroundDrawer(({ draw }) => {
			draw.startGroup(-state.viewport.x, -state.viewport.y);
			for (const { x, y, width, height, entryName } of outlines) {
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y + height - 1, PALETTE_INDICES.strokeBase, width, 1);
				draw.drawFill(x, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawFill(x + width - 1, y, PALETTE_INDICES.strokeBase, 1, height);
				draw.drawText(x + state.viewport.vGrid, y, entryName, PALETTE_INDICES.inkStrong);
			}
			draw.endGroup();
		});
		const selectors = ['codeBlockRendering.currentProject.blocks', 'projectChange'] as const;
		const geometryEvents = ['codeBlockLayoutsChanged', 'gridSizeChanged', 'viewportChanged', 'viewportResized'];
		for (const selector of selectors) store.subscribe(selector, updateOutlines);
		for (const event of geometryEvents) events.on(event, updateOutlines);
		events.on('resolveCodeBlockInsertionEntry', onInsertionEntry);
		updateOutlines();
		return () => {
			unregisterDrawer();
			for (const selector of selectors) store.unsubscribe(selector, updateOutlines);
			for (const event of geometryEvents) events.off(event, updateOutlines);
			events.off('resolveCodeBlockInsertionEntry', onInsertionEntry);
		};
	},
};
