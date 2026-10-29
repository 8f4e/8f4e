import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import { getExportBaseName, logError, serializeProjectTo8f4e, serializeToProject } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import {
	downloadBlob,
	type FilePickerWindow,
	isPickerCancellation,
	openProjectFile,
	type ProjectFileHandle,
	projectFileType,
} from './browser-files';

export function createProjectFilesPlugin({
	inputTarget,
	showOpenMenuItem = true,
}: {
	inputTarget: HTMLElement;
	showOpenMenuItem?: boolean;
}): EditorPlugin {
	return {
		id: 'project-files',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const document = inputTarget.ownerDocument;
			const browserWindow = document.defaultView as FilePickerWindow;
			let activeHandle: ProjectFileHandle | undefined;
			let generation = 0;
			let writes: Promise<void> = Promise.resolve();
			let pendingDestination: Promise<ProjectFileHandle> | undefined;
			let disposed = false;
			const clearFileAssociation = () => {
				generation++;
				activeHandle = undefined;
				pendingDestination = undefined;
			};
			const unregisterOpen = menus.registerItem('mainMenu', () =>
				showOpenMenuItem ? { title: 'Open From Disk', action: 'importProject', close: true } : undefined
			);
			const unregisterExport = menus.registerItem('mainMenu', () => ({
				title: 'Export Project',
				action: 'exportProject',
				close: true,
			}));
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
				activeHandle = handle;
			};
			const writeProject = (data: string, fileName: string, saveAs: boolean): Promise<void> => {
				const currentGeneration = generation;
				const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
				let destination: Promise<ProjectFileHandle | undefined>;
				// Start pickers and permissions in the user gesture, before queued writes.
				if (!saveAs && pendingDestination) {
					destination = pendingDestination;
				} else if (!saveAs && activeHandle) {
					const handle = activeHandle;
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
						if (isPickerCancellation(result.error)) return;
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
					if (currentGeneration === generation) activeHandle = result.handle;
				});
				const completion = operation.finally(() => {
					if (pendingDestination === destination) pendingDestination = undefined;
				});
				writes = completion.catch(() => undefined);
				return completion;
			};
			const save = (saveAs: boolean) => {
				const project = serializeToProject(state);
				let text: string;
				try {
					text = serializeProjectTo8f4e(project);
				} catch (error) {
					logError(state, `Failed to serialize project: ${String(error)}`);
					return;
				}
				return writeProject(text, `${getExportBaseName(state)}.8f4e`, saveAs).catch(error => {
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
			events.on('loadProject', clearFileAssociation);
			events.on('importProject', onImport);
			events.on('saveProject', onSave);
			events.on('exportProject', onExport);
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				disposed = true;
				clearFileAssociation();
				inputTarget.removeEventListener('keydown', onKeydown);
				events.off('loadProject', clearFileAssociation);
				events.off('importProject', onImport);
				events.off('saveProject', onSave);
				events.off('exportProject', onExport);
				unregisterOpen();
				unregisterExport();
			};
		},
	};
}
