import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawWaves from './drawer/draw';
import { createWaveDirectives } from './state/directive';
import type { Wave } from './types';

export const wavePlugin: EditorPlugin = {
	id: 'wave',
	setup: ({ store, directives, drawers }) => {
		const state = store.getState();
		const wavesByBlock = new WeakMap<CodeBlockGraphicData, Wave[]>();
		const unregisterDirectives = createWaveDirectives(wavesByBlock).map(definition => directives.register(definition));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawWaves(draw, state, wavesByBlock.get(codeBlock) ?? [], memoryViews);
		});
		return () => {
			unregisterDrawer();
			for (const unregister of unregisterDirectives) unregister();
		};
	},
};
