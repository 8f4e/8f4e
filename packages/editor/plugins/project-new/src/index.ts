import type { EditorPlugin } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';

export const newProjectPlugin: EditorPlugin = {
	id: 'project-new',
	setup: ({ events, menus }) => {
		const unregisterMenuItem = menus.registerItem('mainMenu', ({ state }) => {
			if (state.editorMode === 'edit') return { title: 'New Project', action: 'new', close: true };
		});
		const onNew = () => events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		events.on('new', onNew);
		return () => {
			unregisterMenuItem();
			events.off('new', onNew);
		};
	},
};
