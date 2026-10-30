import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileHandle, ProjectFileSession } from '@8f4e/editor-file-session';
import { getExportBaseName, logError, serializeToProject } from '@8f4e/editor-state';
import { downloadBlob, projectFileType, type SaveFilePickerWindow } from './browser-files';
import { serializeProjectTo8f4e } from './serializeTo8f4e';

export function createProjectSavePlugin({
	inputTarget,
	fileSession,
}: {
	inputTarget: HTMLElement;
	fileSession: ProjectFileSession;
}): EditorPlugin {
	return {
		id: 'project-save',
		setup: ({ store, events, menus }) => {
			const document = inputTarget.ownerDocument;
			const browserWindow = document.defaultView as SaveFilePickerWindow;
			let generation = 0;
			let writes: Promise<void> = Promise.resolve();
			let pendingDestination: Promise<ProjectFileHandle> | undefined;
			const resetDestination = () => {
				generation++;
				pendingDestination = undefined;
			};
			const unregister = menus.registerItem('mainMenu', () => ({
				title: 'Export Project',
				action: 'exportProject',
				close: true,
			}));
			const writeProject = (blob: Blob, fileName: string, saveAs: boolean): Promise<void> => {
				const currentGeneration = generation;
				let destination: Promise<ProjectFileHandle | undefined>;
				// Start pickers and permissions in the user gesture, before queued writes.
				if (!saveAs && pendingDestination) {
					destination = pendingDestination;
				} else if (!saveAs && fileSession.handle) {
					const handle = fileSession.handle;
					destination = handle.requestPermission({ mode: 'readwrite' }).then(permission => {
						if (permission !== 'granted') throw new Error('Permission to save the project was denied');
						return handle;
					});
				} else if (browserWindow.showSaveFilePicker) {
					const picked = browserWindow.showSaveFilePicker({ suggestedName: fileName, types: [projectFileType] });
					pendingDestination = picked;
					destination = picked;
				} else {
					destination = Promise.resolve(undefined);
				}
				// Observe rejection immediately while an earlier write may still be pending.
				const prepared = destination.then(
					handle => ({ handle }),
					error => ({ error })
				);
				const operation = writes.then(async () => {
					const result = await prepared;
					if ('error' in result) {
						if (result.error instanceof Error && result.error.name === 'AbortError') return;
						throw result.error;
					}
					if (!result.handle) {
						downloadBlob(document, blob, fileName);
						return;
					}
					const writable = await result.handle.createWritable();
					try {
						await writable.write(blob);
						await writable.close();
					} catch (error) {
						await writable.abort().catch(() => undefined);
						throw error;
					}
					if (currentGeneration === generation) fileSession.handle = result.handle;
				});
				const completion = operation.finally(() => {
					if (pendingDestination === destination) pendingDestination = undefined;
				});
				writes = completion.catch(() => undefined);
				return completion;
			};
			const save = (saveAs: boolean) => {
				const state = store.getState();
				let text: string;
				try {
					text = serializeProjectTo8f4e(serializeToProject(state));
				} catch (error) {
					logError(state, `Failed to serialize project: ${String(error)}`);
					return;
				}
				return writeProject(
					new Blob([text], { type: 'text/plain;charset=utf-8' }),
					`${getExportBaseName(state)}.8f4e`,
					saveAs
				).catch(error => {
					logError(state, `Failed to save project: ${String(error)}`);
				});
			};
			const onSave = () => save(false);
			const onExport = () => save(true);
			const onKeydown = (event: KeyboardEvent) => {
				if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
				event.preventDefault();
				events.dispatch('saveProject');
			};
			events.on('loadProject', resetDestination);
			events.on('saveProject', onSave);
			events.on('exportProject', onExport);
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				resetDestination();
				inputTarget.removeEventListener('keydown', onKeydown);
				events.off('loadProject', resetDestination);
				events.off('saveProject', onSave);
				events.off('exportProject', onExport);
				unregister();
			};
		},
	};
}
