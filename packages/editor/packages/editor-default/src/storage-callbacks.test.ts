import type { ProjectObjectModel } from '@8f4e/language-spec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectFileCallbacks } from './storage-callbacks';

const { parseProjectSource } = vi.hoisted(() => ({
	parseProjectSource: vi.fn(),
}));

vi.mock('@8f4e/compiler', () => ({ parseProjectSource }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createHandle() {
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	return {
		getFile: vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue('source') }),
		requestPermission: vi.fn().mockResolvedValue('granted'),
		createWritable: vi.fn().mockResolvedValue(writable),
		writable,
	};
}

describe('project file callbacks', () => {
	let handle: ReturnType<typeof createHandle>;
	let showSaveFilePicker: ReturnType<typeof vi.fn>;
	let showOpenFilePicker: ReturnType<typeof vi.fn>;
	let callbacks: ReturnType<typeof createProjectFileCallbacks>;
	const project = { modules: [] } as unknown as ProjectObjectModel;

	beforeEach(() => {
		handle = createHandle();
		showSaveFilePicker = vi.fn().mockResolvedValue(handle);
		showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
		vi.stubGlobal('window', { showSaveFilePicker, showOpenFilePicker });
		parseProjectSource.mockReset().mockReturnValue(project);
		callbacks = createProjectFileCallbacks();
	});

	afterEach(() => vi.unstubAllGlobals());

	it('starts the first picker synchronously and reuses its handle for later saves', async () => {
		const first = callbacks.saveProject('first', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledWith({
			suggestedName: 'demo.8f4e',
			types: [{ description: '8f4e Project', accept: { 'text/plain': ['.8f4e'] } }],
		});
		await first;
		await callbacks.saveProject('second', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledOnce();
		expect(await handle.writable.write.mock.calls[0][0].text()).toBe('first');
		expect(await handle.writable.write.mock.calls[1][0].text()).toBe('second');
	});

	it('adopts an opened handle only after the editor loads the parsed project', async () => {
		const imported = await callbacks.importProject();
		expect(showOpenFilePicker).toHaveBeenCalledWith(
			expect.objectContaining({ multiple: false, excludeAcceptAllOption: true })
		);
		expect(parseProjectSource).toHaveBeenCalledWith('source');
		callbacks.projectLoaded(imported!);
		const save = callbacks.saveProject('edited', 'demo.8f4e');
		expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
		await save;
		expect(showSaveFilePicker).not.toHaveBeenCalled();
		expect(handle.writable.close).toHaveBeenCalledOnce();
	});

	it('reports denied permission, retains the handle, and permits retry', async () => {
		callbacks.projectLoaded((await callbacks.importProject())!);
		handle.requestPermission.mockResolvedValueOnce('denied');
		await expect(callbacks.saveProject('edited', 'demo.8f4e')).rejects.toThrow('Permission');
		expect(handle.createWritable).not.toHaveBeenCalled();
		await callbacks.saveProject('retry', 'demo.8f4e');
		expect(showSaveFilePicker).not.toHaveBeenCalled();
		expect(handle.writable.close).toHaveBeenCalledOnce();
	});

	it('a successful export selects a new destination for subsequent saves', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const second = createHandle();
		showSaveFilePicker.mockResolvedValueOnce(second);
		await callbacks.exportProject('export', 'copy.8f4e');
		await callbacks.saveProject('later', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
		expect(handle.writable.write).toHaveBeenCalledOnce();
		expect(second.writable.write).toHaveBeenCalledTimes(2);
	});

	it('clears the association when another project replaces the current project', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		callbacks.projectLoaded(project);
		await callbacks.saveProject('new project', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
	});

	it('keeps file handles isolated between editors', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const second = createProjectFileCallbacks();
		await second.saveProject('second', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
	});

	it('silently cancels open and save-as pickers without losing the existing handle', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const cancelled = new DOMException('Cancelled', 'AbortError');
		showOpenFilePicker.mockRejectedValueOnce(cancelled);
		expect(await callbacks.importProject()).toBeNull();
		showSaveFilePicker.mockRejectedValueOnce(cancelled);
		await expect(callbacks.exportProject('copy', 'copy.8f4e')).resolves.toBeUndefined();
		await callbacks.saveProject('later', 'demo.8f4e');
		expect(handle.writable.write).toHaveBeenCalledTimes(2);
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
	});

	it('reopens the save picker after cancelling the first save', async () => {
		showSaveFilePicker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
		await callbacks.saveProject('first', 'demo.8f4e');
		await callbacks.saveProject('retry', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
		expect(handle.writable.write).toHaveBeenCalledOnce();
	});

	it.each(['getFile', 'parse'] as const)('retains the prior handle after an open %s failure', async failure => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const second = createHandle();
		showOpenFilePicker.mockResolvedValueOnce([second]);
		if (failure === 'getFile') second.getFile.mockRejectedValueOnce(new Error('read failed'));
		else
			parseProjectSource.mockImplementationOnce(() => {
				throw new Error('parse failed');
			});
		await expect(callbacks.importProject()).rejects.toThrow('failed');
		await callbacks.saveProject('later', 'demo.8f4e');
		expect(handle.writable.write).toHaveBeenCalledTimes(2);
		expect(second.createWritable).not.toHaveBeenCalled();
	});

	it.each(['write', 'close'] as const)('aborts a failed %s and retains the previous destination', async failure => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const second = createHandle();
		second.writable[failure].mockRejectedValueOnce(new Error('disk full'));
		showSaveFilePicker.mockResolvedValueOnce(second);
		await expect(callbacks.exportProject('copy', 'copy.8f4e')).rejects.toThrow('disk full');
		expect(second.writable.abort).toHaveBeenCalledOnce();
		await callbacks.saveProject('later', 'demo.8f4e');
		expect(handle.writable.write).toHaveBeenCalledTimes(2);
	});

	it('coalesces overlapping pickers and serializes writes in command order', async () => {
		const picked = deferred<typeof handle>();
		const firstWrite = deferred<void>();
		showSaveFilePicker.mockReturnValueOnce(picked.promise);
		handle.writable.write.mockReturnValueOnce(firstWrite.promise);
		const first = callbacks.saveProject('first', 'demo.8f4e');
		const second = callbacks.saveProject('second', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledOnce();
		picked.resolve(handle);
		await vi.waitFor(() => expect(handle.writable.write).toHaveBeenCalledOnce());
		expect(handle.createWritable).toHaveBeenCalledOnce();
		firstWrite.resolve();
		await Promise.all([first, second]);
		expect(handle.writable.close.mock.invocationCallOrder[0]).toBeLessThan(
			handle.createWritable.mock.invocationCallOrder[1]
		);
		expect(await handle.writable.write.mock.calls[1][0].text()).toBe('second');
	});

	it('uses the pending save-as destination for a save issued before export finishes', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		const second = createHandle();
		showSaveFilePicker.mockResolvedValueOnce(second);
		await Promise.all([callbacks.exportProject('copy', 'copy.8f4e'), callbacks.saveProject('newer', 'demo.8f4e')]);
		expect(handle.writable.write).toHaveBeenCalledOnce();
		expect(second.writable.write).toHaveBeenCalledTimes(2);
	});

	it('finishes a delayed save without adopting its handle after a project replacement', async () => {
		const picked = deferred<typeof handle>();
		showSaveFilePicker.mockReturnValueOnce(picked.promise);
		const save = callbacks.saveProject('old project', 'demo.8f4e');
		callbacks.projectLoaded(project);
		picked.resolve(handle);
		await save;
		expect(handle.writable.close).toHaveBeenCalledOnce();
		expect(await handle.writable.write.mock.calls[0][0].text()).toBe('old project');
		await callbacks.saveProject('new project', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
	});

	it('finishes in-flight and queued saves to their captured handle after replacement', async () => {
		await callbacks.saveProject('initial', 'demo.8f4e');
		handle.writable.write.mockClear();
		handle.writable.close.mockClear();
		handle.createWritable.mockClear();
		const firstWrite = deferred<void>();
		handle.writable.write.mockReturnValueOnce(firstWrite.promise);
		const first = callbacks.saveProject('old project', 'demo.8f4e');
		const second = callbacks.saveProject('also old', 'demo.8f4e');
		await vi.waitFor(() => expect(handle.writable.write).toHaveBeenCalledOnce());
		callbacks.projectLoaded(project);
		firstWrite.resolve();
		await Promise.all([first, second]);
		expect(handle.writable.abort).not.toHaveBeenCalled();
		expect(handle.writable.close).toHaveBeenCalledTimes(2);
		expect(await handle.writable.write.mock.calls[0][0].text()).toBe('old project');
		expect(await handle.writable.write.mock.calls[1][0].text()).toBe('also old');
		expect(handle.writable.close.mock.invocationCallOrder[0]).toBeLessThan(
			handle.createWritable.mock.invocationCallOrder[1]
		);

		const replacementHandle = createHandle();
		showSaveFilePicker.mockResolvedValueOnce(replacementHandle);
		await callbacks.saveProject('new project', 'new.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
		expect(replacementHandle.writable.close).toHaveBeenCalledOnce();
		expect(handle.writable.write).toHaveBeenCalledTimes(2);
	});

	it('finishes an accepted save when the mounted editor is disposed', async () => {
		const picked = deferred<typeof handle>();
		showSaveFilePicker.mockReturnValueOnce(picked.promise);
		const save = callbacks.saveProject('old project', 'demo.8f4e');
		callbacks.dispose();
		picked.resolve(handle);
		await save;
		expect(handle.writable.close).toHaveBeenCalledOnce();
		expect(handle.writable.abort).not.toHaveBeenCalled();
	});

	it('downloads every save when picker APIs are unavailable', async () => {
		vi.stubGlobal('window', {});
		const link = { style: {}, click: vi.fn(), href: '', download: '' };
		vi.stubGlobal('document', {
			createElement: vi.fn().mockReturnValue(link),
			body: { appendChild: vi.fn(), removeChild: vi.fn() },
		});
		const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:project');
		const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
		await callbacks.saveProject('first', 'demo.8f4e');
		await callbacks.saveProject('second', 'demo.8f4e');
		expect(link.download).toBe('demo.8f4e');
		expect(link.click).toHaveBeenCalledTimes(2);
		expect(await (createUrl.mock.calls[1][0] as Blob).text()).toBe('second');
		expect(revokeUrl).toHaveBeenCalledTimes(2);
		createUrl.mockRestore();
		revokeUrl.mockRestore();
	});

	it('fallback uploads clear the prior association only after a successful load', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		vi.stubGlobal('window', { showSaveFilePicker });
		const listeners = new Map<string, () => void>();
		const input = {
			type: '',
			accept: '',
			files: [{ text: vi.fn().mockResolvedValue('uploaded source') }],
			addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
			click: vi.fn(),
		};
		vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(input) });
		const open = callbacks.importProject();
		expect(input.accept).toBe('.8f4e');
		listeners.get('change')!();
		callbacks.projectLoaded((await open)!);
		await callbacks.saveProject('uploaded project', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
	});

	it('resolves fallback upload cancellation without changing the association', async () => {
		await callbacks.saveProject('first', 'demo.8f4e');
		vi.stubGlobal('window', { showSaveFilePicker });
		const listeners = new Map<string, () => void>();
		const input = { addEventListener: vi.fn((name, callback) => listeners.set(name, callback)), click: vi.fn() };
		vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(input) });
		const open = callbacks.importProject();
		listeners.get('cancel')!();
		expect(await open).toBeNull();
		await callbacks.saveProject('later', 'demo.8f4e');
		expect(showSaveFilePicker).toHaveBeenCalledOnce();
	});
});
