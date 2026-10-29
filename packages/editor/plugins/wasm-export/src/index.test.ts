import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createWasmExportPlugin } from './index';

const cleanups: Array<() => void> = [];
function setup(installed = true, mode: 'view' | 'edit' = 'edit') {
	const events = createEvents();
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: mode });
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	const handle = { createWritable: vi.fn().mockResolvedValue(writable) };
	const browserWindow = {
		showSaveFilePicker: vi.fn().mockResolvedValue(handle),
		URL: { createObjectURL: vi.fn().mockReturnValue('blob:wasm'), revokeObjectURL: vi.fn() },
	};
	const link = { style: {}, href: '', download: '', click: vi.fn(), remove: vi.fn() };
	const document = {
		defaultView: browserWindow,
		createElement: vi.fn().mockReturnValue(link),
		body: { appendChild: vi.fn() },
	};
	const getCodeBuffer = vi.fn(() => new Uint8Array([0, 97, 115, 109]));
	const disposePlugin = installed
		? createWasmExportPlugin({ document: document as unknown as Document, getCodeBuffer }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers: createCodeBlockDrawerRegistry(),
			})
		: () => {};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	return {
		events,
		store,
		state: store.getState(),
		writable,
		handle,
		browserWindow,
		document,
		link,
		getCodeBuffer,
		disposePlugin,
	};
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('WebAssembly export plugin', () => {
	it.each(['view', 'edit'] as const)('opens the picker synchronously through the main menu in %s mode', async mode => {
		const test = setup(true, mode);
		await test.events.dispatchAsync('contextmenu', { x: 80, y: 80 });
		test.browserWindow.showSaveFilePicker.mockImplementationOnce(async () => {
			expect(test.state.contextMenu.open).toBe(false);
			return test.handle;
		});
		test.state.contextMenu.highlightedItem = test.state.contextMenu.items.findIndex(
			item => item.action === 'exportWasm'
		);
		test.events.dispatch('mousedown', { x: 80, y: 80, stopPropagation: false });
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledWith({
			suggestedName: 'project.wasm',
			types: [{ description: 'WebAssembly Binary', accept: { 'application/wasm': ['.wasm'] } }],
		});
		await vi.waitFor(() => expect(test.writable.close).toHaveBeenCalledOnce());
		const blob = test.writable.write.mock.calls[0][0] as Blob;
		expect(blob.type).toBe('application/wasm');
		expect(new Uint8Array(await blob.arrayBuffer())).toEqual(test.getCodeBuffer());
	});
	it.each(['demo', 'demo.wasm', 'demo.8f4e'])('uses the configured filename %s', async name => {
		const test = setup();
		test.state.editorConfig.export = { fileName: name };
		await test.events.dispatchAsync('exportWasm');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledWith(
			expect.objectContaining({ suggestedName: 'demo.wasm' })
		);
	});
	it('reads and snapshots the current compiler bytes for each export', async () => {
		const test = setup();
		const bytes = new Uint8Array([1, 2, 3]);
		test.getCodeBuffer.mockReturnValue(bytes);
		const first = test.events.dispatchAsync('exportWasm');
		bytes[0] = 4;
		await first;
		expect(new Uint8Array(await test.writable.write.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
		await test.events.dispatchAsync('exportWasm');
		expect(new Uint8Array(await test.writable.write.mock.calls[1][0].arrayBuffer())).toEqual(bytes);
	});
	it('downloads a WASM blob when the save picker is unavailable', async () => {
		const test = setup();
		Reflect.deleteProperty(test.browserWindow, 'showSaveFilePicker');
		await test.events.dispatchAsync('exportWasm');
		expect(test.link.download).toBe('project.wasm');
		expect(test.link.click).toHaveBeenCalledOnce();
		expect(test.link.remove).toHaveBeenCalledOnce();
		expect(test.browserWindow.URL.createObjectURL.mock.calls[0][0].type).toBe('application/wasm');
		expect(test.browserWindow.URL.revokeObjectURL).toHaveBeenCalledWith('blob:wasm');
	});
	it('treats picker cancellation as a cancelled action', async () => {
		const test = setup();
		test.browserWindow.showSaveFilePicker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
		await test.events.dispatchAsync('exportWasm');
		expect(test.writable.write).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([]);
	});
	it.each(['write', 'close'] as const)('aborts and reports a failed %s', async failure => {
		const test = setup();
		test.writable[failure].mockRejectedValueOnce(new Error('disk full'));
		await test.events.dispatchAsync('exportWasm');
		expect(test.writable.abort).toHaveBeenCalledOnce();
		expect(test.state.console.logs.at(-1)?.message).toContain('disk full');
	});
	it('omits the feature when absent and removes its menu and action on disposal', async () => {
		const omitted = setup(false);
		await omitted.events.dispatchAsync('contextmenu', { x: 80, y: 80 });
		expect(omitted.state.contextMenu.items.some(item => item.action === 'exportWasm')).toBe(false);
		const test = setup();
		test.disposePlugin();
		await test.events.dispatchAsync('contextmenu', { x: 80, y: 80 });
		expect(test.state.contextMenu.items.some(item => item.action === 'exportWasm')).toBe(false);
		await test.events.dispatchAsync('exportWasm');
		expect(test.getCodeBuffer).not.toHaveBeenCalled();
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
	});
	it('keeps browser resources and compiler getters isolated between editors', async () => {
		const first = setup();
		const second = setup();
		await first.events.dispatchAsync('exportWasm');
		expect(first.getCodeBuffer).toHaveBeenCalledOnce();
		expect(second.getCodeBuffer).not.toHaveBeenCalled();
		expect(second.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
	});
});
