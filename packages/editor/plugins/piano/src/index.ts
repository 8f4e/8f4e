import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { drawPianoKeyboards } from './drawer/draw';
import { getPianoDefaultEdits } from './helpers/saveDefaults';
import { registerPianoInteraction } from './state/interaction';
import { registerPianoLayout } from './state/layout';
import type { PianoKeyboard } from './types';

const saveAction = 'savePianoValuesToCode';

export function createPianoPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'piano',
		setup: ({ store, events, menus, layout, drawers }) => {
			const state = store.getState();
			const keyboardsByBlock = new WeakMap<CodeBlockGraphicData, PianoKeyboard[]>();
			const unregisterLayout = registerPianoLayout(layout, keyboardsByBlock);
			const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				drawPianoKeyboards(draw, keyboardsByBlock.get(codeBlock) ?? [], memoryViews);
			});
			const unregisterInteraction = registerPianoInteraction(state, events, keyboardsByBlock, writeMemory);
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
				applyCodeBlockSourceEdits(store, edits, { affectsCompilation: true });
			};
			events.on(saveAction, onSave);
			return () => {
				events.off(saveAction, onSave);
				unregisterMenuItem();
				unregisterInteraction();
				unregisterDrawer();
				unregisterLayout();
			};
		},
	};
}
