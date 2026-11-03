import type { ProjectFileHandle } from '@8f4e/editor-file-session';

export type SaveFilePickerWindow = Window &
	typeof globalThis & {
		showSaveFilePicker?: (options: {
			suggestedName: string;
			types: Array<{ description: string; accept: Record<string, string[]> }>;
		}) => Promise<ProjectFileHandle>;
	};

export const projectFileType = { description: '8f4e Project', accept: { 'text/plain': ['.8f4e'] } };

export function downloadBlob(document: Document, blob: Blob, fileName: string): void {
	const browserWindow = document.defaultView as SaveFilePickerWindow;
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
