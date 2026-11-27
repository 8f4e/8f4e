import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import drawWaves from './drawer/draw';
import { registerWavePreparation } from './state/layout';
import type { Wave } from './types';

export const wavePlugin: EditorPlugin = {
	id: 'wave',
	setup: ({ store, layout, renderRegistry }) => {
		const state = store.getState();
		const wavesByBlock = new WeakMap<EditorCodeBlock, Wave[]>();
		const unregisterPreparation = registerWavePreparation(store, layout, wavesByBlock);
		const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawWaves(draw, state, wavesByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			unregisterPreparation();
		};
	},
};
