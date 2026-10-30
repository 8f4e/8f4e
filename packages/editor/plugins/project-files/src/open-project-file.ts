import { type FilePickerWindow, type ProjectFileHandle, projectFileType } from '@8f4e/editor-file-session';

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
