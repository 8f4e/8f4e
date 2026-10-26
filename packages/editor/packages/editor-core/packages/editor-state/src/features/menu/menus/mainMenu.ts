import type { ContextMenuItem, State } from '@8f4e/editor-state-types';

export const mainMenu = (state: State): ContextMenuItem[] => [
	...(state.codeBlockRendering.codeBlocks !== state.codeBlockRendering.rootCodeBlocks
		? [{ title: 'Go back', action: 'goToParentProjectGroup', close: true }, { divider: true }]
		: []),
	...(state.featureFlags.editing
		? [
				{
					title: 'New Module',
					action: 'addCodeBlock',
					payload: { isNew: true, blockType: 'module' },
					close: true,
				},
				{
					title: 'New Function',
					action: 'addCodeBlock',
					payload: { isNew: true, blockType: 'function' },
					close: true,
				},
				{
					title: 'New Prototype',
					action: 'addCodeBlock',
					payload: { isNew: true, blockType: 'prototype' },
					close: true,
				},
				{
					title: 'New Note',
					action: 'addCodeBlock',
					payload: { isNew: true, blockType: 'note' },
					close: true,
				},
				{
					title: 'Paste Code Block',
					action: 'addCodeBlock',
					payload: { isPaste: true },
					close: true,
					disabled: !state.callbacks.readClipboardText,
				},
				{
					title: 'Add Built-in Module',
					action: 'openSubMenu',
					payload: { menu: 'moduleCategoriesMenu', path: [] },
					close: false,
					disabled: !state.callbacks.getListOfModules,
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
	{ divider: true },
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
	...((state.featureFlags.editing && state.featureFlags.projectCreation) || state.featureFlags.projectOpening
		? [{ divider: true }]
		: []),
	{ title: 'Export Project', action: 'exportProject', close: true, disabled: !state.callbacks.exportProject },
	{
		title: 'Export WebAssembly',
		action: 'exportWasm',
		close: true,
		disabled: !state.callbacks.exportBinaryCode,
	},
];
