import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { drawSliders } from './drawer/draw';
import { getSliderDefaultEdits } from './helpers/saveDefaults';
import { registerSliderInteraction } from './state/interaction';
import { registerSliderPreparation } from './state/layout';
import type { Slider } from './types';

const saveAction = 'saveSliderValuesToCode';

export function createSliderPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'slider',
		setup: ({ store, events, menus, layout, renderRegistry }) => {
			const state = store.getState();
			const slidersByBlock = new WeakMap<EditorCodeBlock, Slider[]>();
			const unregisterPreparation = registerSliderPreparation(store, layout, slidersByBlock);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawSliders(draw, state, slidersByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerSliderInteraction(state, events, slidersByBlock, writeMemory);
			const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
				if (state.editorMode !== 'edit' || codeBlock.readOnly || !slidersByBlock.get(codeBlock)?.length) return;
				return {
					title: 'Save slider values to code',
					action: saveAction,
					payload: { codeBlock },
					close: true,
					disabled: !state.callbacks.getWordFromMemory,
				};
			});
			const onSave = ({ codeBlock = state.project.selectedCodeBlock }: { codeBlock?: EditorCodeBlock } = {}) => {
				if (state.editorMode !== 'edit' || !codeBlock) return;
				const edits = getSliderDefaultEdits(state, slidersByBlock.get(codeBlock) ?? []);
				applyCodeBlockSourceEdits(store, edits);
			};
			events.on(saveAction, onSave);
			return () => {
				events.off(saveAction, onSave);
				unregisterMenuItem();
				unregisterInteraction();
				unregisterDrawer();
				unregisterPreparation();
			};
		},
	};
}
