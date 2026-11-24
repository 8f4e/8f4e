import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { type ProjectFileHandle, pickProjectFile, writeProjectFile } from './browser-files';
import { registerExportActions } from './export-actions';
import { openProjectFile } from './open-project-file';
import { createProjectSourceFile, type ProjectSourceFile } from './project-source-file';

/** Open and save projects with a file association private to this editor installation. */
export function createProjectFilesPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'project-files',
		setup: context => {
			const { store, events, menus, loading } = context;
			const document = inputTarget.ownerDocument;
			let currentHandle: ProjectFileHandle | undefined;
			let generation = 0;
			let writes: Promise<void> = Promise.resolve();
			let pendingDestination: Promise<ProjectFileHandle | null> | undefined;
			let disposed = false;
			const pendingLoads = new Set<LoadingIndicatorHandle>();
			const resetDestination = () => {
				currentHandle = undefined;
				generation++;
				pendingDestination = undefined;
			};
			const unregisterOpen = menus.registerItem('mainMenu', () => ({
				title: 'Open From Disk',
				action: 'importProject',
				close: true,
			}));
			const onImport = async () => {
				if (disposed) return;
				let indicator: LoadingIndicatorHandle | undefined;
				try {
					let project: ProjectObjectModel;
					let handle: ProjectFileHandle | undefined;
					try {
						const opened = await openProjectFile(document);
						if (!opened || disposed) return;
						indicator = loading.add({ id: 'project-file', message: 'Loading project...' });
						pendingLoads.add(indicator);
						project = parseProjectSource(await opened.file.text());
						handle = opened.handle;
					} catch (error) {
						if (disposed || (error instanceof Error && error.name === 'AbortError')) return;
						indicator?.fail();
						logError(store.getState(), `Failed to open project: ${String(error)}`);
						return;
					}
					if (disposed) return;
					events.dispatch('loadProject', { project });
					currentHandle = handle;
					indicator.done();
				} catch (error) {
					indicator?.fail();
					throw error;
				} finally {
					if (indicator) {
						pendingLoads.delete(indicator);
						indicator.cancel();
					}
				}
			};
			const writeProject = async (file: ProjectSourceFile, saveAs: boolean): Promise<void> => {
				const currentGeneration = generation;
				let destination: Promise<ProjectFileHandle | null | undefined>;
				// Start pickers and permissions in the user gesture, before queued writes.
				if (!saveAs && pendingDestination) {
					destination = pendingDestination;
				} else if (!saveAs && currentHandle) {
					const handle = currentHandle;
					destination = handle.requestPermission({ mode: 'readwrite' }).then(permission => {
						if (permission !== 'granted') throw new Error('Permission to save the project was denied');
						return handle;
					});
				} else {
					pendingDestination = pickProjectFile(document, file.fileName);
					destination = pendingDestination ?? Promise.resolve(undefined);
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
					if (result.handle === null) return;
					await writeProjectFile(document, file, result.handle);
					if (result.handle && currentGeneration === generation) currentHandle = result.handle;
				});
				const completion = operation.finally(() => {
					if (pendingDestination === destination) pendingDestination = undefined;
				});
				writes = completion.catch(() => undefined);
				return completion;
			};
			const save = (saveAs: boolean) => {
				const state = store.getState();
				const file = createProjectSourceFile(state);
				if (!file) return;
				return writeProject(file, saveAs).catch(error => {
					logError(state, `Failed to save project: ${String(error)}`);
				});
			};
			const onSave = () => save(false);
			const unregisterExport = registerExportActions(context, inputTarget, () => save(true), 'saveProject');
			events.on('loadProject', resetDestination);
			events.on('importProject', onImport);
			events.on('saveProject', onSave);
			return () => {
				disposed = true;
				resetDestination();
				events.off('loadProject', resetDestination);
				events.off('importProject', onImport);
				events.off('saveProject', onSave);
				unregisterOpen();
				unregisterExport();
				for (const indicator of pendingLoads) indicator.cancel();
				pendingLoads.clear();
			};
		},
	};
}
