import {
	downloadBlob,
	type FilePickerWindow,
	isPickerCancellation,
	type ProjectFileHandle,
	projectFileType,
} from './browser-files';
import type { ProjectFileSession } from './index';

export function writeProjectFile({
	fileSession,
	document,
	blob,
	fileName,
	saveAs,
}: {
	fileSession: ProjectFileSession;
	document: Document;
	blob: Blob;
	fileName: string;
	saveAs: boolean;
}): Promise<void> {
	const browserWindow = document.defaultView as FilePickerWindow;
	const currentGeneration = fileSession.generation;
	let destination: Promise<ProjectFileHandle | undefined>;
	// Start pickers and permissions in the user gesture, before queued writes.
	if (!saveAs && fileSession.pendingDestination) {
		destination = fileSession.pendingDestination;
	} else if (!saveAs && fileSession.handle) {
		const handle = fileSession.handle;
		destination = handle.requestPermission({ mode: 'readwrite' }).then(permission => {
			if (permission !== 'granted') throw new Error('Permission to save the project was denied');
			return handle;
		});
	} else if (browserWindow.showSaveFilePicker) {
		const picked = browserWindow.showSaveFilePicker({ suggestedName: fileName, types: [projectFileType] });
		fileSession.pendingDestination = picked;
		destination = picked;
	} else {
		destination = Promise.resolve(undefined);
	}
	// Observe rejection immediately while an earlier write may still be pending.
	const prepared = destination.then(
		handle => ({ handle }),
		error => ({ error })
	);
	const operation = fileSession.writes.then(async () => {
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
		if (currentGeneration === fileSession.generation) fileSession.handle = result.handle;
	});
	const completion = operation.finally(() => {
		if (fileSession.pendingDestination === destination) fileSession.pendingDestination = undefined;
	});
	fileSession.writes = completion.catch(() => undefined);
	return completion;
}
