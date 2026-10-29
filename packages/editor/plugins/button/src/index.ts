import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { drawButtons } from './drawer/draw';
import { createButtonDirective } from './state/directive';
import { registerButtonInteraction } from './state/interaction';
import type { ButtonWidget } from './types';

export function createButtonPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'button',
		setup: ({ store, events, directives, drawers }) => {
			const state = store.getState();
			const buttonsByBlock = new WeakMap<CodeBlockGraphicData, ButtonWidget[]>();
			const unregisterDirective = directives.register(createButtonDirective(buttonsByBlock));
			const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawButtons(draw, state, buttonsByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerButtonInteraction(state, events, buttonsByBlock, writeMemory);
			return () => {
				unregisterInteraction();
				unregisterDrawer();
				unregisterDirective();
			};
		},
	};
}
