import type { EditorPlugin } from '@8f4e/editor-core';
import { type ProjectFileSession, writeProjectFile } from '@8f4e/editor-file-session';
import { getExportBaseName, logError, serializeProjectTo8f4e, serializeToProject } from '@8f4e/editor-state';

export function createProjectExportPlugin({
	document,
	fileSession,
}: {
	document: Document;
	fileSession: ProjectFileSession;
}): EditorPlugin {
	return {
		id: 'project-export',
		setup: ({ store, events, menus }) => {
			const unregister = menus.registerItem('mainMenu', () => ({
				title: 'Export Project',
				action: 'exportProject',
				close: true,
			}));
			const onExport = () => {
				let text: string;
				try {
					text = serializeProjectTo8f4e(serializeToProject(store.getState()));
				} catch (error) {
					logError(store.getState(), `Failed to serialize project: ${String(error)}`);
					return;
				}
				return writeProjectFile({
					fileSession,
					document,
					blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
					fileName: `${getExportBaseName(store.getState())}.8f4e`,
					saveAs: true,
				}).catch(error => {
					logError(store.getState(), `Failed to save project: ${String(error)}`);
				});
			};
			events.on('exportProject', onExport);
			return () => {
				events.off('exportProject', onExport);
				unregister();
			};
		},
	};
}
