import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { drawPianoKeyboards } from './drawer/draw';
import { getPianoDefaultEdits } from './helpers/saveDefaults';
import { registerPianoInteraction } from './state/interaction';
import { registerPianoPreparation } from './state/layout';
import type { PianoKeyboard, PianoMemoryBindings } from './types';

const saveAction = 'savePianoValuesToCode';

export function createPianoPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'piano',
		setup: ({ store, events, menus, layout, renderRegistry }) => {
			const state = store.getState();
			const bindingsByBlock = new WeakMap<EditorCodeBlock, PianoMemoryBindings[]>();
			const keyboardsByBlock = new WeakMap<EditorCodeBlock, PianoKeyboard[]>();
			const unregisterPreparation = registerPianoPreparation(store, layout, bindingsByBlock, keyboardsByBlock);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawPianoKeyboards(draw, keyboardsByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerPianoInteraction(state, events, keyboardsByBlock, writeMemory);
			const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
				if (state.editorMode !== 'edit' || codeBlock.readOnly || !bindingsByBlock.get(codeBlock)?.length) return;
				return {
					title: 'Save piano values to code',
					action: saveAction,
					payload: { codeBlock },
					close: true,
					disabled: !state.callbacks.getWordFromMemory,
				};
			});
			const onSave = ({ codeBlock = state.project.selectedCodeBlock }: { codeBlock?: EditorCodeBlock } = {}) => {
				if (state.editorMode !== 'edit' || !codeBlock) return;
				const edits = getPianoDefaultEdits(state, bindingsByBlock.get(codeBlock) ?? []);
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
