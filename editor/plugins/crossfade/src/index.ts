import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import drawCrossfade from './drawer/draw';
import { registerCrossfadeInteraction } from './state/interaction';
import { registerCrossfadePreparation } from './state/layout';
import type { Crossfade } from './types';

export function createCrossfadePlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'crossfade',
		setup: ({ store, events, layout, renderRegistry }) => {
			const state = store.getState();
			const crossfadesByBlock = new WeakMap<EditorCodeBlock, Crossfade[]>();
			const unregisterPreparation = registerCrossfadePreparation(store, layout, crossfadesByBlock);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawCrossfade(draw, crossfadesByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerCrossfadeInteraction(state, events, crossfadesByBlock, writeMemory);
			return () => {
				unregisterInteraction();
				unregisterDrawer();
				unregisterPreparation();
			};
		},
	};
}
