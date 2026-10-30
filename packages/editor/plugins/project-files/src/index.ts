import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import {
	isPickerCancellation,
	type ProjectFileHandle,
	type ProjectFileSession,
	writeProjectFile,
} from '@8f4e/editor-file-session';
import { getExportBaseName, logError, serializeProjectTo8f4e, serializeToProject } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { openProjectFile } from './open-project-file';

export function createProjectFilesPlugin({
	inputTarget,
	fileSession,
	showOpenMenuItem = true,
}: {
	inputTarget: HTMLElement;
	fileSession: ProjectFileSession;
	showOpenMenuItem?: boolean;
}): EditorPlugin {
	return {
		id: 'project-files',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const document = inputTarget.ownerDocument;
			let disposed = false;
			const unregisterOpen = menus.registerItem('mainMenu', () =>
				showOpenMenuItem ? { title: 'Open From Disk', action: 'importProject', close: true } : undefined
			);
			const onImport = async () => {
				let project: ProjectObjectModel;
				let handle: ProjectFileHandle | undefined;
				try {
					const opened = await openProjectFile(document);
					if (!opened) return;
					project = parseProjectSource(await opened.file.text());
					handle = opened.handle;
				} catch (error) {
					if (disposed || isPickerCancellation(error)) return;
					logError(state, `Failed to open project: ${String(error)}`);
					return;
				}
				if (disposed) return;
				events.dispatch('loadProject', { project });
				fileSession.handle = handle;
			};
			const onSave = () => {
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
					saveAs: false,
				}).catch(error => {
					logError(store.getState(), `Failed to save project: ${String(error)}`);
				});
			};
			const onKeydown = (event: KeyboardEvent) => {
				if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
				event.preventDefault();
				events.dispatch('saveProject');
			};
			events.on('importProject', onImport);
			events.on('saveProject', onSave);
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				disposed = true;
				inputTarget.removeEventListener('keydown', onKeydown);
				events.off('importProject', onImport);
				events.off('saveProject', onSave);
				unregisterOpen();
			};
		},
	};
}
