import type { EditorPlugin } from '@8f4e/editor-core';
import { incrementProjectRevision, removeDirective } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { getProjectOpenerKeyword } from '@8f4e/project-preparser';

export const toggleFavoritePlugin: EditorPlugin = {
	id: 'toggle-favorite',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
			if (!store.getState().featureFlags.editing) return;

			if (codeBlock.isFavorite) {
				codeBlock.code = removeDirective(codeBlock.code, 'favorite');
			} else {
				const headerIndex = codeBlock.code.findIndex(line => getProjectOpenerKeyword(line.trim()) !== null);
				codeBlock.code.splice(headerIndex + 1, 0, '; @favorite');
			}
			codeBlock.lastUpdated = Date.now();
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
			incrementProjectRevision(store);
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
