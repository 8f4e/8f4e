import type { ContextMenuItem, State } from '@8f4e/editor-state-types';

export const mainMenu = (state: State): ContextMenuItem[] => [
	...(state.codeBlockRendering.currentProject.blocks !== state.codeBlockRendering.rootProject.blocks
		? [{ title: 'Go back', action: 'goToParentProjectGroup', close: true }, { divider: true }]
		: []),
	...(state.editorMode === 'edit'
		? [
				{
					title: 'Go @home',
					action: 'goHome',
					close: true,
				},
			]
		: []),
	...(state.editorMode === 'edit' && state.featureFlags.projectCreation ? [{ divider: true }] : []),
	...(state.editorMode === 'edit' && state.featureFlags.projectCreation
		? [{ title: 'New Project', action: 'new', close: true }]
		: []),
];
