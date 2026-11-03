import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawWaves from './drawer/draw';
import { registerWaveLayout } from './state/layout';
import type { Wave } from './types';

export const wavePlugin: EditorPlugin = {
	id: 'wave',
	setup: ({ store, layout, drawers }) => {
		const state = store.getState();
		const wavesByBlock = new WeakMap<CodeBlockGraphicData, Wave[]>();
		const unregisterLayout = registerWaveLayout(layout, wavesByBlock);
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawWaves(draw, state, wavesByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterLayout();
		};
	},
};
