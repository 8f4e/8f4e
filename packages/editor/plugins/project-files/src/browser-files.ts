export type ProjectFileHandle = FileSystemFileHandle & {
	requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export type FilePickerWindow = Window &
	typeof globalThis & {
		showOpenFilePicker?: (options: {
			types: Array<{ description: string; accept: Record<string, string[]> }>;
			multiple: boolean;
			excludeAcceptAllOption: boolean;
		}) => Promise<ProjectFileHandle[]>;
		showSaveFilePicker?: (options: {
			suggestedName: string;
			types: Array<{ description: string; accept: Record<string, string[]> }>;
		}) => Promise<ProjectFileHandle>;
	};

export const projectFileType = { description: '8f4e Project', accept: { 'text/plain': ['.8f4e'] } };

export function isPickerCancellation(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

export async function openProjectFile(document: Document): Promise<{
	file: File;
	handle: ProjectFileHandle | undefined;
} | null> {
	const browserWindow = document.defaultView as FilePickerWindow;
	if (browserWindow.showOpenFilePicker) {
		const [handle] = await browserWindow.showOpenFilePicker({
			types: [projectFileType],
			multiple: false,
			excludeAcceptAllOption: true,
		});
		return { file: await handle.getFile(), handle };
	}
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.8f4e';
	return new Promise(resolve => {
		input.addEventListener('cancel', () => resolve(null), { once: true });
		input.addEventListener(
			'change',
			() => {
				const file = input.files?.[0];
				resolve(file ? { file, handle: undefined } : null);
			},
			{ once: true }
		);
		input.click();
	});
}

export function downloadBlob(document: Document, blob: Blob, fileName: string): void {
	const browserWindow = document.defaultView as FilePickerWindow;
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
