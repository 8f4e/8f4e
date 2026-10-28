import { parseProjectSource } from '@8f4e/compiler';
import type { ProjectObjectModel } from '@8f4e/language-spec';

interface WritableProjectFile {
	write: (data: Blob) => Promise<void>;
	close: () => Promise<void>;
	abort: () => Promise<void>;
}

// The picker and permission APIs are not yet included in all TypeScript DOM libraries.
interface ProjectFileHandle {
	getFile: () => Promise<File>;
	createWritable: () => Promise<WritableProjectFile>;
	requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
}

interface FilePickerOptions {
	suggestedName?: string;
	multiple?: boolean;
	excludeAcceptAllOption?: boolean;
	types: Array<{ description: string; accept: Record<string, string[]> }>;
}

type PickerWindow = Window & {
	showOpenFilePicker?: (options: FilePickerOptions) => Promise<ProjectFileHandle[]>;
	showSaveFilePicker?: (options: FilePickerOptions) => Promise<ProjectFileHandle>;
};

const projectFileType = { description: '8f4e Project', accept: { 'text/plain': ['.8f4e'] } };

function isPickerCancellation(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

export function createProjectFileCallbacks() {
	let activeHandle: ProjectFileHandle | undefined;
	let generation = 0;
	let writes: Promise<void> = Promise.resolve();
	let pendingDestination: Promise<ProjectFileHandle> | undefined;
	const importedHandles = new WeakMap<ProjectObjectModel, ProjectFileHandle>();

	function dispose(): void {
		generation++;
		activeHandle = undefined;
		pendingDestination = undefined;
	}

	function projectLoaded(project: ProjectObjectModel): void {
		dispose();
		activeHandle = importedHandles.get(project);
		importedHandles.delete(project);
	}

	async function importProject(): Promise<ProjectObjectModel | null> {
		const pickerWindow = window as PickerWindow;
		if (!pickerWindow.showOpenFilePicker) {
			return importProjectWithInput();
		}

		let handle: ProjectFileHandle;
		try {
			[handle] = await pickerWindow.showOpenFilePicker({
				types: [projectFileType],
				multiple: false,
				excludeAcceptAllOption: true,
			});
		} catch (error) {
			if (isPickerCancellation(error)) return null;
			throw error;
		}
		const project = parseProjectSource(await (await handle.getFile()).text());
		// Adopt only when the editor actually replaces its project, after reading and parsing succeed.
		importedHandles.set(project, handle);
		return project;
	}

	async function save(data: string, fileName: string, saveAs: boolean): Promise<void> {
		const currentGeneration = generation;
		const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
		const pickerWindow = window as PickerWindow;
		let destination: Promise<ProjectFileHandle | undefined>;

		// Start pickers and permission requests during the command's user activation, before queuing writes.
		if (!saveAs && pendingDestination) {
			destination = pendingDestination;
		} else if (!saveAs && activeHandle) {
			const handle = activeHandle;
			destination = handle.requestPermission({ mode: 'readwrite' }).then(permission => {
				if (permission !== 'granted') throw new Error('Permission to save the project was denied');
				return handle;
			});
		} else if (pickerWindow.showSaveFilePicker) {
			const picked = pickerWindow.showSaveFilePicker({ suggestedName: fileName, types: [projectFileType] });
			pendingDestination = picked;
			destination = picked;
		} else {
			destination = Promise.resolve(undefined);
		}

		// Observe picker rejection immediately, even if an earlier write is still pending.
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
				downloadBlob(blob, fileName);
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
	}

	return {
		dispose,
		importProject,
		projectLoaded,
		saveProject: (data: string, fileName: string) => save(data, fileName, false),
		exportProject: (data: string, fileName: string) => save(data, fileName, true),
	};
}

async function importProjectWithInput(): Promise<ProjectObjectModel | null> {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.8f4e';

	return new Promise((resolve, reject) => {
		input.addEventListener('cancel', () => resolve(null), { once: true });
		input.addEventListener(
			'change',
			async () => {
				const file = input.files?.[0];
				if (!file) {
					resolve(null);
					return;
				}
				try {
					resolve(parseProjectSource(await file.text()));
				} catch (error) {
					reject(error);
				}
			},
			{ once: true }
		);
		input.click();
	});
}

export async function exportBinaryCode(fileName: string, codeBuffer: Uint8Array): Promise<void> {
	const blob = new Blob([new Uint8Array(codeBuffer)], { type: 'application/wasm' });
	const browserWindow = window as PickerWindow;
	if (browserWindow.showSaveFilePicker) {
		const handle = await browserWindow.showSaveFilePicker({
			suggestedName: fileName,
			types: [{ description: 'WebAssembly Binary', accept: { 'application/wasm': ['.wasm'] } }],
		});
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close();
		return;
	}

	downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	document.body.appendChild(a);
	a.style.display = 'none';
	a.href = url;
	a.download = fileName;
	a.click();

	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
