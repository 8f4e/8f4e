import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawCrossfade from './drawer/draw';
import { createCrossfadeDirective } from './state/directive';
import { registerCrossfadeInteraction } from './state/interaction';
import type { Crossfade } from './types';

export function createCrossfadePlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'crossfade',
		setup: ({ store, events, directives, drawers }) => {
			const state = store.getState();
			const crossfadesByBlock = new WeakMap<CodeBlockGraphicData, Crossfade[]>();
			const unregisterDirective = directives.register(createCrossfadeDirective(crossfadesByBlock));
			const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawCrossfade(draw, crossfadesByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerCrossfadeInteraction(state, events, crossfadesByBlock, writeMemory);
			return () => {
				unregisterInteraction();
				unregisterDrawer();
				unregisterDirective();
			};
		},
	};
}
