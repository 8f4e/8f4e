import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, jumpToCodeBlock, removeDirective } from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { getProjectOpenerKeyword } from '@8f4e/project-preparser';

function isFavorite(block: EditorCodeBlock): boolean {
	return block.parsedDirectives.some(directive => directive.name === 'favorite');
}

export const favoritesPlugin: EditorPlugin = {
	id: 'favorites',
	setup: ({ store, events, menus }) => {
		store.set('envConstantContributions.favorites', ['; @favorite']);
		const onToggle = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			if (store.getState().editorMode !== 'edit') return;

			const favorite = isFavorite(codeBlock);
			const code = favorite ? removeDirective(codeBlock.code, 'favorite') : [...codeBlock.code];
			if (!favorite) {
				const headerIndex = codeBlock.code.findIndex(line => getProjectOpenerKeyword(line.trim()) !== null);
				code.splice(headerIndex + 1, 0, '; @favorite');
			}
			applyCodeBlockSourceEdits(store, [{ codeBlock, code }]);
		};

		events.on('toggleFavoriteDirective', onToggle);
		const onJump = ({ creationIndex }: { creationIndex: number }) => jumpToCodeBlock(store, creationIndex, events);
		events.on('jumpToFavoriteCodeBlock', onJump);
		const unregisterBlockMenu = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit' || codeBlock.readOnly) return;
			return {
				title: isFavorite(codeBlock) ? 'Unfavorite' : 'Favorite',
				action: 'toggleFavoriteDirective',
				payload: { codeBlock },
				close: true,
			};
		});
		const unregisterJumpMenu = menus.registerItem('mainMenu', () => ({
			title: 'Jump to...',
			action: 'openSubMenu',
			payload: { menu: 'favoritesMenu' },
			close: false,
		}));
		const unregisterFavoritesMenu = menus.registerMenu('favoritesMenu', state => {
			const favorites = state.project.activeLevel.blocks
				.filter(isFavorite)
				.sort((a, b) => a.creationIndex - b.creationIndex);
			return favorites.length
				? favorites.map(block => ({
						title: `${block.blockType} ${block.name}`,
						action: 'jumpToFavoriteCodeBlock',
						payload: { creationIndex: block.creationIndex },
						close: true,
					}))
				: [{ title: 'No favorites', disabled: true }];
		});
		return () => {
			unregisterFavoritesMenu();
			unregisterJumpMenu();
			unregisterBlockMenu();
			events.off('jumpToFavoriteCodeBlock', onJump);
			events.off('toggleFavoriteDirective', onToggle);
			const contributions = { ...store.getState().envConstantContributions };
			delete contributions.favorites;
			store.set('envConstantContributions', contributions);
		};
	},
};
