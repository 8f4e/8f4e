import type { EditorPlugin } from '@8f4e/editor-core';
import { getExportBaseName, logError, serializeProjectTo8f4e, serializeToProject } from '@8f4e/editor-state';

export function createProjectExportPlugin({
	inputTarget,
	saveProject,
	exportProject,
}: {
	inputTarget: HTMLElement;
	saveProject: (text: string, fileName: string) => Promise<void>;
	exportProject: (text: string, fileName: string) => Promise<void>;
}): EditorPlugin {
	return {
		id: 'project-export',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const unregisterMenu = menus.registerItem('mainMenu', () => ({
				title: 'Export Project',
				action: 'exportProject',
				close: true,
			}));
			const save = (callback: (text: string, fileName: string) => Promise<void>) => {
				const project = serializeToProject(state);
				let text: string;
				try {
					text = serializeProjectTo8f4e(project);
				} catch (error) {
					console.error('Failed to serialize project:', error);
					logError(state, 'Failed to serialize project');
					return;
				}
				return callback(text, `${getExportBaseName(state)}.8f4e`).catch(error => {
					console.error('Failed to save project to file:', error);
					logError(state, 'Failed to save project to file');
				});
			};
			const onSave = () => save(saveProject);
			const onExport = () => save(exportProject);
			const onKeydown = (event: KeyboardEvent) => {
				if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
				event.preventDefault();
				events.dispatch('saveProject');
			};
			events.on('saveProject', onSave);
			events.on('exportProject', onExport);
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				inputTarget.removeEventListener('keydown', onKeydown);
				events.off('saveProject', onSave);
				events.off('exportProject', onExport);
				unregisterMenu();
			};
		},
	};
}
