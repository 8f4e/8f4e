import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { hasIntermodularMemoryConnections, removeIntermodularMemoryConnectionsFromCode } from './removeConnections';

export const removeMemoryConnectionsPlugin: EditorPlugin = {
	id: 'remove-memory-connections',
	setup: ({ store, events, menus }) => {
		const onRemove = ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
			if (!store.getState().featureFlags.editing) return;
			const code = removeIntermodularMemoryConnectionsFromCode(codeBlock.code);
			if (!code) return;

			applyCodeBlockSourceEdits(store, [{ codeBlock, code }], { affectsCompilation: true });
		};

		events.on('removeConnections', onRemove);
		const unregisterMenu = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (!state.featureFlags.editing) return;
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
