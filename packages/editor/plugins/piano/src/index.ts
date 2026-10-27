import type { EditorPlugin } from '@8f4e/editor-core';
import { incrementCompilerInputRevision } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { drawPianoKeyboards } from './drawer/draw';
import { getPianoDefaultEdits } from './helpers/saveDefaults';
import { createPianoDirective } from './state/directive';
import { registerPianoInteraction } from './state/interaction';
import type { PianoKeyboard } from './types';

const saveAction = 'savePianoValuesToCode';

export const pianoPlugin: EditorPlugin = {
	id: 'piano',
	setup: ({ store, events, menus, directives, drawers }) => {
		const state = store.getState();
		const keyboardsByBlock = new WeakMap<CodeBlockGraphicData, PianoKeyboard[]>();
		const unregisterDirective = directives.register(createPianoDirective(keyboardsByBlock));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			drawPianoKeyboards(draw, keyboardsByBlock.get(codeBlock) ?? [], memoryViews);
		});
		const unregisterInteraction = registerPianoInteraction(state, events, keyboardsByBlock);
		const unregisterMenuItem = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (!state.featureFlags.editing || !keyboardsByBlock.get(codeBlock)?.length) return;
			return {
				title: 'Save piano values to code',
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
			const edits = getPianoDefaultEdits(state, keyboardsByBlock.get(codeBlock) ?? []);
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
