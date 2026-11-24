import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import drawPlot from './drawer/draw';
import { registerPlotPreparation } from './state/layout';
import type { Plot } from './types';

export const plotPlugin: EditorPlugin = {
	id: 'plot',
	setup: ({ store, layout, renderRegistry }) => {
		const plotsByBlock = new WeakMap<EditorCodeBlock, Plot[]>();
		const unregisterPreparation = registerPlotPreparation(store, layout, plotsByBlock);
		const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawPlot(draw, plotsByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterPreparation();
		};
	},
};
