import type { EditorCodeBlock, EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, removeDirective, upsertDirective } from '@8f4e/editor-state';

const action = 'toggleCodeBlockDisabled';

export const toggleDisabledPlugin: EditorPlugin = {
	id: 'toggle-disabled',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			if (store.getState().editorMode !== 'edit' || codeBlock.readOnly) return;
			const code = codeBlock.disabled
				? removeDirective(codeBlock.code, 'disabled')
				: upsertDirective(codeBlock.code, 'disabled');
			applyCodeBlockSourceEdits(store, [{ codeBlock, code }]);
		};
		events.on(action, onToggle);
		const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit' || codeBlock.readOnly) return;
			const label = codeBlock.childLevel ? 'group' : codeBlock.isProjectScope ? 'project' : codeBlock.blockType;
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
