import type { ContextMenuItem, State } from '@8f4e/editor-state-types';

export const mainMenu = (state: State): ContextMenuItem[] => [
	...(state.codeBlockRendering.codeBlocks !== state.codeBlockRendering.rootCodeBlocks
		? [{ title: 'Go back', action: 'goToParentProjectGroup', close: true }, { divider: true }]
		: []),
	...(state.featureFlags.editing
		? [
				{
					title: 'New Module',
					action: 'createCodeBlock',
					payload: { blockType: 'module' },
					close: true,
				},
				{
					title: 'New Function',
					action: 'createCodeBlock',
					payload: { blockType: 'function' },
					close: true,
				},
				{
					title: 'New Prototype',
					action: 'createCodeBlock',
					payload: { blockType: 'prototype' },
					close: true,
				},
				{
					title: 'New Note',
					action: 'createCodeBlock',
					payload: { blockType: 'note' },
					close: true,
				},
				{
					title: 'Paste Code Block',
					action: 'pasteCodeBlocks',
					close: true,
					disabled: !state.callbacks.readClipboardText,
				},
			]
		: []),
	...(state.featureFlags.editing ? [{ divider: true }] : []),
	...(state.featureFlags.editing
		? [
				{
					title: 'Go @home',
					action: 'goHome',
					close: true,
				},
			]
		: []),
	{
		title: 'Jump to...',
		action: 'openSubMenu',
		payload: { menu: 'favoritesMenu' },
		close: false,
	},
	...((state.featureFlags.editing && state.featureFlags.projectCreation) || state.featureFlags.projectOpening
		? [{ divider: true }]
		: []),
	...(state.featureFlags.editing && state.featureFlags.projectCreation
		? [{ title: 'New Project', action: 'new', close: true }]
		: []),
	...(state.featureFlags.editing && state.featureFlags.projectCreation && state.featureFlags.projectOpening
		? [{ divider: true }]
		: []),
	...(state.featureFlags.projectOpening
		? [
				{
					title: 'Open From Disk',
					action: 'importProject',
					close: true,
					disabled: !state.callbacks.importProject,
				},
			]
		: []),
];
