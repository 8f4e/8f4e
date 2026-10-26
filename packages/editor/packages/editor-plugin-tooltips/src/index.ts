import type { EditorPlugin } from '@8f4e/editor-core';
import drawTooltip from './drawer/draw';
import createTooltip from './state/effect';

export const tooltipsPlugin: EditorPlugin = {
	id: 'tooltips',
	setup: ({ store, events, drawers }) => {
		const tooltip = createTooltip(store, events);
		const unregisterDrawer = drawers.registerCodeBlockOverlay(({ draw, state, codeBlock, memoryViews }) => {
			drawTooltip(draw, state, codeBlock, memoryViews, tooltip.getState());
		});
		return () => {
			unregisterDrawer();
			tooltip.dispose();
		};
	},
};
