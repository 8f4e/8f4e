import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawBars from './drawer/draw';
import { createBarsDirective } from './state/directive';
import type { Bars } from './types';

export const barsPlugin: EditorPlugin = {
	id: 'bars',
	setup: ({ directives, drawers }) => {
		const barsByBlock = new WeakMap<CodeBlockGraphicData, Bars[]>();
		const unregisterDirective = directives.register(createBarsDirective(barsByBlock));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawBars(draw, barsByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterDirective();
		};
	},
};
