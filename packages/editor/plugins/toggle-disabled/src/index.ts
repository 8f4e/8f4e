import type { EditorCodeBlock, EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, removeDirective, upsertDirective } from '@8f4e/editor-state';

const action = 'toggleCodeBlockDisabled';

/** Structural group and root-scope source do not support disabled compiler metadata. */
const supportsToggle = (codeBlock: EditorCodeBlock) =>
	!codeBlock.readOnly && !codeBlock.childLevel && !codeBlock.isProjectScope;

export const toggleDisabledPlugin: EditorPlugin = {
	id: 'toggle-disabled',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			if (store.getState().editorMode !== 'edit' || !supportsToggle(codeBlock)) return;
			const code = codeBlock.disabled
				? removeDirective(codeBlock.code, 'disabled')
				: upsertDirective(codeBlock.code, 'disabled');
			applyCodeBlockSourceEdits(store, [{ codeBlock, code }]);
		};
		events.on(action, onToggle);
		const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit' || !supportsToggle(codeBlock)) return;
			const label = codeBlock.blockType;
			return {
				title: codeBlock.disabled ? `Enable ${label}` : `Disable ${label}`,
				action,
				payload: { codeBlock },
				close: true,
			};
		});
		return () => {
			unregisterMenuItem();
			events.off(action, onToggle);
		};
	},
};
