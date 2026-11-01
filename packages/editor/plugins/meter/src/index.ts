import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawMeter from './drawer/draw';
import { registerMeterLayout } from './state/layout';
import type { Meter } from './types';

export const meterPlugin: EditorPlugin = {
	id: 'meter',
	setup: ({ layout, drawers }) => {
		const metersByBlock = new WeakMap<CodeBlockGraphicData, Meter[]>();
		const unregisterLayout = registerMeterLayout(layout, metersByBlock);
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawMeter(draw, metersByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterLayout();
		};
	},
};
