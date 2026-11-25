import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import drawMeter from './drawer/draw';
import { registerMeterPreparation } from './state/layout';
import type { Meter } from './types';

export const meterPlugin: EditorPlugin = {
	id: 'meter',
	setup: ({ store, layout, renderRegistry }) => {
		const metersByBlock = new WeakMap<EditorCodeBlock, Meter[]>();
		const unregisterPreparation = registerMeterPreparation(store, layout, metersByBlock);
		const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawMeter(draw, metersByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterPreparation();
		};
	},
};
