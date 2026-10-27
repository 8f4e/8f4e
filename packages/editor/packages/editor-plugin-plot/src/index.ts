import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawPlot from './drawer/draw';
import { createPlotDirective } from './state/directive';
import type { Plot } from './types';

export const plotPlugin: EditorPlugin = {
	id: 'plot',
	setup: ({ directives, drawers }) => {
		const plotsByBlock = new WeakMap<CodeBlockGraphicData, Plot[]>();
		const unregisterDirective = directives.register(createPlotDirective(plotsByBlock));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawPlot(draw, plotsByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterDirective();
		};
	},
};
