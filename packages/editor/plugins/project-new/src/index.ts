import type { EditorPlugin } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';

export const newProjectPlugin: EditorPlugin = {
	id: 'project-new',
	setup: ({ menus }) =>
		menus.registerItem('mainMenu', ({ state }) => {
			if (state.editorMode === 'edit') {
				return {
					title: 'New Project',
					action: 'loadProject',
					payload: { project: EMPTY_DEFAULT_PROJECT },
					close: true,
				};
			}
		}),
};
