import { parseProjectSource } from '@8f4e/compiler';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { createProjectOpenPlugin } from '@8f4e/editor-plugin-project-open';
import { createProjectSavePlugin } from '@8f4e/editor-plugin-project-save';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/file-events';

const source = '8f4e/v1\nentry main\nmodule test\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(complete => {
		resolve = complete;
	});
	return { promise, resolve };
}
function createHandle() {
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	return {
		getFile: vi.fn().mockResolvedValue(new File([source], 'test.8f4e')),
		requestPermission: vi.fn().mockResolvedValue('granted'),
		createWritable: vi.fn().mockResolvedValue(writable),
		writable,
	};
}
function setup({ mode = 'edit' }: { mode?: 'edit' | 'view' } = {}) {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const handle = createHandle();
	const browserWindow = {
		showSaveFilePicker: vi.fn().mockResolvedValue(handle),
		showOpenFilePicker: vi.fn().mockResolvedValue([handle]),
		URL: { createObjectURL: vi.fn().mockReturnValue('blob:project'), revokeObjectURL: vi.fn() },
	};
	const document = { defaultView: browserWindow };
	const inputTarget = Object.assign(new EventTarget(), { ownerDocument: document }) as unknown as HTMLElement;
	const fileSession = createProjectFileSession();
	const plugins = [
		fileSession.plugin,
		createProjectOpenPlugin({ document: inputTarget.ownerDocument, fileSession }),
		createProjectSavePlugin({ inputTarget, fileSession }),
	];
	const pluginCleanups = plugins.map(plugin =>
		plugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			drawers: createEditorDrawerRegistry(),
		})
	);
	const disposePlugin = () => {
		while (pluginCleanups.length) pluginCleanups.pop()!();
	};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const keydown = (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) => {
		const event = Object.assign(new Event('keydown', { cancelable: true }), {
			key,
			ctrlKey: false,
			metaKey: false,
			...modifiers,
		});
		inputTarget.dispatchEvent(event);
		return event;
	};
	const openMenu = () => events.dispatchAsync('contextmenu', { x: 800, y: 400 });
	return { events, state, handle, browserWindow, keydown, openMenu, disposePlugin };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('project Open/Save composition', () => {
	it.each(['edit', 'view'] as const)('opens and exports through the main menu in %s mode', async mode => {
		const test = setup({ mode });
		await test.openMenu();
		const openIndex = test.state.contextMenu.items.findIndex(item => item.action === 'importProject');
		expect(openIndex).toBeGreaterThanOrEqual(0);
		await test.events.dispatchAsync('activateContextMenuItem', {
			x: 800,
			y: 400,
			index: openIndex,
		});
		await vi.waitFor(() => expect(test.handle.getFile).toHaveBeenCalledOnce());
		await test.events.dispatchAsync('exportProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		expect(await test.handle.writable.write.mock.calls[0][0].text()).toContain('int value 1');
		expect(test.state.contextMenu.open).toBe(false);
	});
	it('reuses the opened file for Save and adopts the exported destination for later saves', async () => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		await test.events.dispatchAsync('saveProject');
		expect(test.handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
		const second = createHandle();
		test.browserWindow.showSaveFilePicker.mockResolvedValueOnce(second);
		await test.events.dispatchAsync('exportProject');
		await test.events.dispatchAsync('saveProject');
		expect(second.writable.write).toHaveBeenCalledTimes(2);
		expect(test.handle.writable.write).toHaveBeenCalledOnce();
	});
	it('preserves spatial configuration precedence through saving and reopening', async () => {
		const test = setup();
		test.events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1
note right
; @pos 20 0
; @config export.fileName right
noteEnd
entry main
module left
; @pos -20 0
; @config export.fileName left
moduleEnd
entryEnd`),
		});
		expect(test.state.editorConfig.export?.fileName).toBe('right');
		await test.events.dispatchAsync('saveProject');
		const savedSource = await test.handle.writable.write.mock.calls[0][0].text();
		test.handle.getFile.mockResolvedValueOnce(new File([savedSource], 'right.8f4e'));
		await test.events.dispatchAsync('importProject');
		expect(test.state.editorConfig.export?.fileName).toBe('right');
	});
	it.each(['loadProject', 'new'])('clears the association on %s', async action => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		test.events.dispatch(action, { project: parseProjectSource(source) });
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
	});
	it('keeps the opened destination across undo and redo', async () => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		test.state.historyStack.push(parseProjectSource(source.replace('value 1', 'value 2')));
		test.events.dispatch('undo');
		test.events.dispatch('redo');
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
		expect(test.handle.writable.close).toHaveBeenCalledOnce();
	});
	it('preserves the destination after cancelling open or export', async () => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const cancel = new DOMException('Cancelled', 'AbortError');
		test.browserWindow.showOpenFilePicker.mockRejectedValueOnce(cancel);
		await test.events.dispatchAsync('importProject');
		test.browserWindow.showSaveFilePicker.mockRejectedValueOnce(cancel);
		await test.events.dispatchAsync('exportProject');
		await test.events.dispatchAsync('saveProject');
		expect(test.state.console.logs).toEqual([]);
		expect(test.handle.writable.write).toHaveBeenCalledOnce();
	});
	it.each(['getFile', 'parse'])('preserves the destination after an open %s failure', async failure => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const second = createHandle();
		if (failure === 'getFile') second.getFile.mockRejectedValueOnce(new Error('read failed'));
		else second.getFile.mockResolvedValueOnce(new File(['invalid'], 'broken.8f4e'));
		test.browserWindow.showOpenFilePicker.mockResolvedValueOnce([second]);
		await test.events.dispatchAsync('importProject');
		expect(test.state.console.logs.at(-1)?.message).toContain('Failed to open project');
		await test.events.dispatchAsync('saveProject');
		expect(test.handle.writable.write).toHaveBeenCalledOnce();
		expect(second.createWritable).not.toHaveBeenCalled();
	});
	it('finishes accepted writes after disposal and ignores an open that finishes later', async () => {
		const test = setup();
		const picked = deferred<typeof test.handle>();
		test.browserWindow.showSaveFilePicker.mockReturnValueOnce(picked.promise);
		const opened = deferred<Array<typeof test.handle>>();
		test.browserWindow.showOpenFilePicker.mockReturnValueOnce(opened.promise);
		const save = test.events.dispatchAsync('saveProject');
		const open = test.events.dispatchAsync('importProject');
		const original = test.state.initialProjectState;
		test.disposePlugin();
		picked.resolve(test.handle);
		opened.resolve([test.handle]);
		await Promise.all([save, open]);
		expect(test.handle.writable.close).toHaveBeenCalledOnce();
		expect(test.state.initialProjectState).toBe(original);
	});
	it('keeps file destinations and shortcuts isolated between editors', async () => {
		const first = setup();
		const second = setup();
		await first.events.dispatchAsync('importProject');
		await second.events.dispatchAsync('saveProject');
		expect(first.handle.writable.write).not.toHaveBeenCalled();
		expect(second.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		first.disposePlugin();
		expect(second.keydown('s', { metaKey: true }).defaultPrevented).toBe(true);
	});
});
