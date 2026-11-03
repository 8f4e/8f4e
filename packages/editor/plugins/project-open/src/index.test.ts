import { parseProjectSource } from '@8f4e/compiler';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createProjectOpenPlugin } from './index';

const source = '8f4e/v1\nentry main\nmodule test\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup({
	installed = true,
	showOpenMenuItem = true,
	mode = 'edit',
}: {
	installed?: boolean;
	showOpenMenuItem?: boolean;
	mode?: 'edit' | 'view';
} = {}) {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const handle = { getFile: vi.fn().mockResolvedValue(new File([source], 'test.8f4e')) };
	const browserWindow = { showOpenFilePicker: vi.fn().mockResolvedValue([handle]) };
	const input = Object.assign(new EventTarget(), { files: [new File([source], 'uploaded.8f4e')], click: vi.fn() });
	const document = { defaultView: browserWindow, createElement: vi.fn().mockReturnValue(input) };
	const fileSession = createProjectFileSession();
	let cleanup = installed
		? createProjectOpenPlugin({ document: document as unknown as Document, fileSession, showOpenMenuItem }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers: createEditorDrawerRegistry(),
			})
		: undefined;
	const disposePlugin = () => {
		cleanup?.();
		cleanup = undefined;
	};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const openMenu = () => events.dispatchAsync('contextmenu', { x: 800, y: 400 });
	return { events, state, handle, browserWindow, document, input, fileSession, openMenu, disposePlugin };
}

it.each(['edit', 'view'] as const)('opens from the contributed menu in %s mode', async mode => {
	const test = setup({ mode });
	await test.openMenu();
	const index = test.state.contextMenu.items.findIndex(item => item.action === 'importProject');
	expect(index).toBeGreaterThanOrEqual(0);
	test.state.contextMenu.highlightedItem = index;
	const original = test.state.initialProjectState;
	await test.events.dispatchAsync('pointerdown', { x: 800, y: 400, stopPropagation: false });
	await vi.waitFor(() => expect(test.fileSession.handle).toBe(test.handle));
	expect(test.state.initialProjectState).not.toBe(original);
	expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!.code).toContain(
		'int value 1'
	);
	expect(test.state.contextMenu.open).toBe(false);
});

it('hides the menu item without removing the import action', async () => {
	const test = setup({ showOpenMenuItem: false });
	await test.openMenu();
	expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
	await test.events.dispatchAsync('importProject');
	expect(test.fileSession.handle).toBe(test.handle);
});

it.each(['getFile', 'parse', 'cancel'])(
	'preserves the project and file association after %s failure',
	async failure => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const original = test.state.initialProjectState;
		if (failure === 'cancel')
			test.browserWindow.showOpenFilePicker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
		else {
			const getFile =
				failure === 'getFile'
					? vi.fn().mockRejectedValue(new Error('read failed'))
					: vi.fn().mockResolvedValue(new File(['invalid'], 'broken.8f4e'));
			test.browserWindow.showOpenFilePicker.mockResolvedValueOnce([{ getFile }]);
		}
		await test.events.dispatchAsync('importProject');
		expect(test.state.initialProjectState).toBe(original);
		expect(test.fileSession.handle).toBe(test.handle);
		if (failure === 'cancel') expect(test.state.console.logs).toEqual([]);
		else expect(test.state.console.logs.at(-1)?.message).toContain('Failed to open project');
	}
);

it.each(['change', 'cancel'])('handles file input %s when the picker is unavailable', async action => {
	const test = setup();
	await test.events.dispatchAsync('importProject');
	const original = test.state.initialProjectState;
	Reflect.deleteProperty(test.browserWindow, 'showOpenFilePicker');
	const pending = test.events.dispatchAsync('importProject');
	expect(test.document.createElement).toHaveBeenCalledWith('input');
	expect(test.input.click).toHaveBeenCalledOnce();
	test.input.dispatchEvent(new Event(action));
	await pending;
	expect(test.fileSession.handle).toBe(action === 'change' ? undefined : test.handle);
	if (action === 'change') expect(test.state.initialProjectState).not.toBe(original);
	else expect(test.state.initialProjectState).toBe(original);
});

it('ignores an open that finishes after disposal', async () => {
	const test = setup();
	let finish!: (handles: Array<typeof test.handle>) => void;
	test.browserWindow.showOpenFilePicker.mockReturnValueOnce(
		new Promise(resolve => {
			finish = resolve;
		})
	);
	const original = test.state.initialProjectState;
	const pending = test.events.dispatchAsync('importProject');
	test.disposePlugin();
	finish([test.handle]);
	await pending;
	expect(test.state.initialProjectState).toBe(original);
	expect(test.fileSession.handle).toBeUndefined();
});

it('removes its menu and action on disposal and is absent when not installed', async () => {
	for (const installed of [true, false]) {
		const test = setup({ installed });
		test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
		await test.events.dispatchAsync('importProject');
		expect(test.browserWindow.showOpenFilePicker).not.toHaveBeenCalled();
	}
});
