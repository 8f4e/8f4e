import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { hasIntermodularMemoryConnections, removeIntermodularMemoryConnectionsFromCode } from './removeConnections';

export const removeMemoryConnectionsPlugin: EditorPlugin = {
	id: 'remove-memory-connections',
	setup: ({ store, events, menus }) => {
		const onRemove = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			if (store.getState().editorMode !== 'edit') return;
			const code = removeIntermodularMemoryConnectionsFromCode(codeBlock.code);
			if (!code) return;

			applyCodeBlockSourceEdits(store, [{ codeBlock, code }]);
		};

		events.on('removeConnections', onRemove);
		const unregisterMenu = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit' || codeBlock.readOnly) return;
			return {
				title: 'Remove connections',
				action: 'removeConnections',
				payload: { codeBlock },
				close: true,
				disabled: !hasIntermodularMemoryConnections(codeBlock.code),
			};
		});
		return () => {
			unregisterMenu();
			events.off('removeConnections', onRemove);
		};
	},
};
