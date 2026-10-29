import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, removeDirective } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { getProjectOpenerKeyword } from '@8f4e/project-preparser';

export const toggleFavoritePlugin: EditorPlugin = {
	id: 'toggle-favorite',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
			if (!store.getState().featureFlags.editing) return;

			const code = codeBlock.isFavorite ? removeDirective(codeBlock.code, 'favorite') : [...codeBlock.code];
			if (!codeBlock.isFavorite) {
				const headerIndex = codeBlock.code.findIndex(line => getProjectOpenerKeyword(line.trim()) !== null);
				code.splice(headerIndex + 1, 0, '; @favorite');
			}
			applyCodeBlockSourceEdits(store, [{ codeBlock, code }], { affectsCompilation: false });
		};

		events.on('toggleFavoriteDirective', onToggle);
		const unregisterMenu = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (!state.featureFlags.editing) return;
			return {
				title: codeBlock.isFavorite ? 'Unfavorite' : 'Favorite',
				action: 'toggleFavoriteDirective',
				payload: { codeBlock },
				close: true,
			};
		});
		return () => {
			unregisterMenu();
			events.off('toggleFavoriteDirective', onToggle);
		};
	},
};
