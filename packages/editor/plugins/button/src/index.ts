import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { drawButtons } from './drawer/draw';
import { registerButtonInteraction } from './state/interaction';
import { registerButtonPreparation } from './state/layout';
import type { ButtonWidget } from './types';

export function createButtonPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'button',
		setup: ({ store, events, layout, renderRegistry }) => {
			const state = store.getState();
			const buttonsByBlock = new WeakMap<EditorCodeBlock, ButtonWidget[]>();
			const unregisterPreparation = registerButtonPreparation(store, layout, buttonsByBlock);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawButtons(draw, state, buttonsByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerButtonInteraction(state, events, buttonsByBlock, writeMemory);
			return () => {
				unregisterInteraction();
				unregisterDrawer();
				unregisterPreparation();
			};
		},
	};
}
