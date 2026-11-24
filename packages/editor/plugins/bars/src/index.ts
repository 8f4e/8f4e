import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawBars from './drawer/draw';
import { registerBarsPreparation } from './state/layout';
import type { Bars } from './types';

export const barsPlugin: EditorPlugin = {
	id: 'bars',
	setup: ({ store, layout, drawers }) => {
		const barsByBlock = new WeakMap<CodeBlockGraphicData, Bars[]>();
		const unregisterPreparation = registerBarsPreparation(store, layout, barsByBlock);
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawBars(draw, barsByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterPreparation();
		};
	},
};
