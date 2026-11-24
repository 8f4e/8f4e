import type { ProjectSourceFile } from './project-source-file';

export type ProjectFileHandle = FileSystemFileHandle & {
	requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
};

type SaveFilePickerWindow = Window &
	typeof globalThis & {
		showSaveFilePicker?: (options: {
			suggestedName: string;
			types: Array<{ description: string; accept: Record<string, string[]> }>;
		}) => Promise<ProjectFileHandle>;
	};

export const projectFileType = { description: '8f4e Project', accept: { 'text/plain': ['.8f4e'] } };

/** No picker returns undefined; a cancelled picker resolves to null. */
export function pickProjectFile(document: Document, fileName: string): Promise<ProjectFileHandle | null> | undefined {
	const browserWindow = document.defaultView as SaveFilePickerWindow;
	return browserWindow.showSaveFilePicker?.({ suggestedName: fileName, types: [projectFileType] }).catch(error => {
		if (error instanceof Error && error.name === 'AbortError') return null;
		throw error;
	});
}

export async function writeProjectFile(
	document: Document,
	{ blob, fileName }: ProjectSourceFile,
	handle?: FileSystemFileHandle
): Promise<void> {
	if (!handle) {
		downloadBlob(document, blob, fileName);
		return;
	}
	const writable = await handle.createWritable();
	try {
		await writable.write(blob);
		await writable.close();
	} catch (error) {
		await writable.abort().catch(() => undefined);
		throw error;
	}
}

function downloadBlob(document: Document, blob: Blob, fileName: string): void {
	const browserWindow = document.defaultView!;
	const url = browserWindow.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.style.display = 'none';
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	try {
		link.click();
	} finally {
		link.remove();
		browserWindow.URL.revokeObjectURL(url);
	}
}
