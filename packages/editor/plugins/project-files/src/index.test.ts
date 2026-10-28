import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createProjectFilesPlugin } from './index';

const source = '8f4e/v1\nentry main\nmodule test\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
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
		getFile: vi.fn().mockResolvedValue(new File([source], 'test.8f4e')),
		requestPermission: vi.fn().mockResolvedValue('granted'),
		createWritable: vi.fn().mockResolvedValue(writable),
		writable,
	};
}
function setup({
	installed = true,
	mode = 'edit',
	showOpenMenuItem = true,
}: {
	installed?: boolean;
	mode?: 'edit' | 'view';
	showOpenMenuItem?: boolean;
} = {}) {
	const events = createEvents();
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: mode });
	const state = store.getState();
	const handle = createHandle();
	const browserWindow = {
		showSaveFilePicker: vi.fn().mockResolvedValue(handle),
		showOpenFilePicker: vi.fn().mockResolvedValue([handle]),
		URL: { createObjectURL: vi.fn().mockReturnValue('blob:project'), revokeObjectURL: vi.fn() },
	};
	const link = { style: {}, href: '', download: '', click: vi.fn(), remove: vi.fn() };
	const document = {
		defaultView: browserWindow,
		createElement: vi.fn().mockReturnValue(link),
		body: { appendChild: vi.fn() },
	};
	const inputTarget = Object.assign(new EventTarget(), { ownerDocument: document }) as unknown as HTMLElement;
	const disposePlugin = installed
		? createProjectFilesPlugin({ inputTarget, showOpenMenuItem }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				drawers: createCodeBlockDrawerRegistry(),
			})
		: () => {};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	const setCode = (comment: string) => {
		state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'test')!.code = [
			'module test',
			`; ${comment}`,
			'moduleEnd',
		];
	};
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
	return { events, store, state, handle, browserWindow, document, link, setCode, keydown, openMenu, disposePlugin };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('project files plugin', () => {
	it.each(['edit', 'view'] as const)('opens and exports through the main menu in %s mode', async mode => {
		const test = setup({ mode });
		await test.openMenu();
		const openIndex = test.state.contextMenu.items.findIndex(item => item.action === 'importProject');
		expect(openIndex).toBeGreaterThanOrEqual(0);
		test.state.contextMenu.highlightedItem = openIndex;
		await test.events.dispatchAsync('mousedown', { x: 800, y: 400, stopPropagation: false });
		await vi.waitFor(() => expect(test.handle.getFile).toHaveBeenCalledOnce());
		await test.events.dispatchAsync('exportProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		expect(await test.handle.writable.write.mock.calls[0][0].text()).toContain('int value 1');
		expect(test.state.contextMenu.open).toBe(false);
	});
	it('hides only the Open menu item when requested by the host', async () => {
		const test = setup({ showOpenMenuItem: false });
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
		expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true);
	});
	it.each([
		{ mode: 'edit', modifier: 'ctrlKey' },
		{ mode: 'edit', modifier: 'metaKey' },
		{ mode: 'view', modifier: 'ctrlKey' },
		{ mode: 'view', modifier: 'metaKey' },
	] as const)('starts the picker synchronously from $modifier+S in $mode mode', async ({ mode, modifier }) => {
		const test = setup({ mode });
		test.setCode('latest code');
		expect(test.keydown('S', { [modifier]: true }).defaultPrevented).toBe(true);
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(test.handle.writable.close).toHaveBeenCalledOnce());
		expect(await test.handle.writable.write.mock.calls[0][0].text()).toContain('latest code');
	});
	it.each([{ key: 's' }, { key: 'x', ctrlKey: true }])('ignores unrelated keys: $key', ({ key, ...modifiers }) => {
		const test = setup();
		expect(test.keydown(key, modifiers).defaultPrevented).toBe(false);
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
	});
	it.each(['demo', 'demo.wasm', 'demo.8f4e'])('uses the configured filename %s', async name => {
		const test = setup();
		test.state.editorConfig.export = { fileName: name };
		await test.events.dispatchAsync('exportProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledWith(
			expect.objectContaining({ suggestedName: 'demo.8f4e' })
		);
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
	it('reports denied permission and allows another save to the same file', async () => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		test.handle.requestPermission.mockResolvedValueOnce('denied');
		await test.events.dispatchAsync('saveProject');
		expect(test.state.console.logs.at(-1)?.message).toContain('Permission');
		expect(test.handle.createWritable).not.toHaveBeenCalled();
		await test.events.dispatchAsync('saveProject');
		expect(test.handle.writable.close).toHaveBeenCalledOnce();
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
	it.each(['write', 'close'] as const)('aborts a failed %s and retains the previous destination', async failure => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const second = createHandle();
		second.writable[failure].mockRejectedValueOnce(new Error('disk full'));
		test.browserWindow.showSaveFilePicker.mockResolvedValueOnce(second);
		await test.events.dispatchAsync('exportProject');
		expect(second.writable.abort).toHaveBeenCalledOnce();
		expect(test.state.console.logs.at(-1)?.message).toContain('disk full');
		await test.events.dispatchAsync('saveProject');
		expect(test.handle.writable.write).toHaveBeenCalledOnce();
	});
	it('coalesces pickers and serializes overlapping saves in command order', async () => {
		const test = setup();
		const picked = deferred<typeof test.handle>();
		const write = deferred<void>();
		test.browserWindow.showSaveFilePicker.mockReturnValueOnce(picked.promise);
		test.handle.writable.write.mockReturnValueOnce(write.promise);
		test.setCode('first');
		const first = test.events.dispatchAsync('saveProject');
		test.setCode('second');
		const second = test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		picked.resolve(test.handle);
		await vi.waitFor(() => expect(test.handle.writable.write).toHaveBeenCalledOnce());
		write.resolve();
		await Promise.all([first, second]);
		expect(await test.handle.writable.write.mock.calls[0][0].text()).toContain('first');
		expect(await test.handle.writable.write.mock.calls[1][0].text()).toContain('second');
		expect(test.handle.writable.close.mock.invocationCallOrder[0]).toBeLessThan(
			test.handle.createWritable.mock.invocationCallOrder[1]
		);
	});
	it('uses the pending Export destination for an overlapping Save', async () => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const second = createHandle();
		test.browserWindow.showSaveFilePicker.mockResolvedValueOnce(second);
		await Promise.all([test.events.dispatchAsync('exportProject'), test.events.dispatchAsync('saveProject')]);
		expect(second.writable.write).toHaveBeenCalledTimes(2);
		expect(test.handle.writable.write).not.toHaveBeenCalled();
	});
	it('finishes an accepted save after replacement without adopting the old destination', async () => {
		const test = setup();
		const picked = deferred<typeof test.handle>();
		test.browserWindow.showSaveFilePicker.mockReturnValueOnce(picked.promise);
		const save = test.events.dispatchAsync('saveProject');
		test.events.dispatch('new');
		picked.resolve(test.handle);
		await save;
		expect(test.handle.writable.close).toHaveBeenCalledOnce();
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(2);
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
	it('downloads every save when the save picker is unavailable', async () => {
		const test = setup();
		Reflect.deleteProperty(test.browserWindow, 'showSaveFilePicker');
		await test.events.dispatchAsync('saveProject');
		await test.events.dispatchAsync('saveProject');
		expect(test.link.download).toBe('project.8f4e');
		expect(test.link.click).toHaveBeenCalledTimes(2);
		expect(test.browserWindow.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
	});
	it.each(['change', 'cancel'])('handles file input %s without an Open picker', async action => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		Reflect.deleteProperty(test.browserWindow, 'showOpenFilePicker');
		const input = Object.assign(new EventTarget(), { files: [new File([source], 'uploaded.8f4e')], click: vi.fn() });
		test.document.createElement.mockReturnValueOnce(input as never);
		const open = test.events.dispatchAsync('importProject');
		input.dispatchEvent(new Event(action));
		await open;
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(action === 'change' ? 1 : 0);
	});
	it('serializes the whole root project while viewing a group', async () => {
		const test = setup();
		const nested = createMockCodeBlock({
			code: ['module voice', 'moduleEnd'],
			blockType: 'module',
			entry: 'main',
			creationIndex: 2,
		});
		test.state.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({
				name: 'Audio',
				code: ['group Audio', 'groupEnd'],
				entry: 'main',
				nestedProjectCodeBlocks: [nested],
				creationIndex: 1,
			})
		);
		test.state.codeBlockRendering.codeBlocks = [nested];
		await test.events.dispatchAsync('saveProject');
		const project = parseProjectSource(await test.handle.writable.write.mock.calls[0][0].text());
		expect(project.modules[0].code).toContain('int value 1');
		expect(project.groups[0].modules[0].code).toEqual(nested.code);
	});
	it('reports incomplete source before opening a picker', async () => {
		const test = setup();
		test.state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'test')!.code = ['module unfinished'];
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
		expect(test.state.console.logs.at(-1)?.message).toContain('Failed to serialize project');
	});
	it('omits the feature when absent and releases menus, actions, and shortcuts', async () => {
		const omitted = setup({ installed: false });
		await omitted.openMenu();
		expect(
			omitted.state.contextMenu.items.some(item => item.action === 'importProject' || item.action === 'exportProject')
		).toBe(false);
		const test = setup();
		test.disposePlugin();
		await test.openMenu();
		expect(
			test.state.contextMenu.items.some(item => item.action === 'importProject' || item.action === 'exportProject')
		).toBe(false);
		expect(test.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(false);
		await test.events.dispatchAsync('saveProject');
		await test.events.dispatchAsync('importProject');
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
		expect(test.browserWindow.showOpenFilePicker).not.toHaveBeenCalled();
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
