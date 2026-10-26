import type { EditorPlugin } from '@8f4e/editor-core';
import { incrementCompilerInputRevision } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { drawSliders } from './drawer/draw';
import { getSliderDefaultEdits } from './helpers/saveDefaults';
import { createSliderDirective } from './state/directive';
import { registerSliderInteraction } from './state/interaction';
import type { Slider } from './types';

const saveAction = 'saveSliderValuesToCode';

export const sliderPlugin: EditorPlugin = {
	id: 'slider',
	setup: ({ store, events, menus, directives, drawers }) => {
		const state = store.getState();
		const slidersByBlock = new WeakMap<CodeBlockGraphicData, Slider[]>();
		const unregisterDirective = directives.register(createSliderDirective(slidersByBlock));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawSliders(draw, state, slidersByBlock.get(codeBlock) ?? [], memoryViews);
		});
		const unregisterInteraction = registerSliderInteraction(state, events, slidersByBlock);
		const unregisterMenuItem = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (!state.featureFlags.editing || !slidersByBlock.get(codeBlock)?.length) return;
			return {
				title: 'Save slider values to code',
				action: saveAction,
				payload: { codeBlock },
				close: true,
				disabled: !state.callbacks.getWordFromMemory,
			};
		});
		const onSave = ({
			codeBlock = state.codeBlockRendering.selectedCodeBlock,
		}: {
			codeBlock?: CodeBlockGraphicData;
		} = {}) => {
			if (!state.featureFlags.editing || !codeBlock) return;
			const edits = getSliderDefaultEdits(state, slidersByBlock.get(codeBlock) ?? []);
			if (!edits.length) return;
			for (const { codeBlock: owner, code } of edits) {
				owner.code = code;
				owner.lastUpdated = Date.now();
				store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', owner);
			}
			incrementCompilerInputRevision(store);
		};
		events.on(saveAction, onSave);
		return () => {
			events.off(saveAction, onSave);
			unregisterMenuItem();
			unregisterInteraction();
			unregisterDrawer();
			unregisterDirective();
		};
	},
};
