import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createProjectExportPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(installed = true, initialEditorMode: 'view' | 'edit' = 'edit') {
	const events = createEvents();
	const saveSession = vi.fn().mockResolvedValue(undefined);
	const store = initState(events, {
		callbacks: { loadSession: async () => null, saveSession },
		runtimeRegistry: {},
		initialEditorMode,
	});
	const state = store.getState();
	const inputTarget = new EventTarget() as HTMLElement;
	const saveProject = vi.fn<(text: string, fileName: string) => Promise<void>>().mockResolvedValue(undefined);
	const exportProject = vi.fn<(text: string, fileName: string) => Promise<void>>().mockResolvedValue(undefined);
	const block = createMockCodeBlock({
		code: ['module test', 'int value 1', 'moduleEnd'],
		blockType: 'module',
		entry: 'main',
	});
	state.codeBlockRendering.rootCodeBlocks.push(block);
	const plugin = createProjectExportPlugin({ inputTarget, saveProject, exportProject });
	const disposePlugin = installed
		? plugin.setup({
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
	const openMenu = async () => {
		events.dispatch('contextmenu', { x: 800, y: 400 });
		await Promise.resolve();
	};
	return {
		events,
		store,
		state,
		block,
		inputTarget,
		saveProject,
		exportProject,
		saveSession,
		disposePlugin,
		keydown,
		openMenu,
	};
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('project export plugin', () => {
	it.each(['edit', 'view'] as const)('exports current source through the main menu in %s mode', async mode => {
		const test = setup(true, mode);
		test.exportProject.mockImplementation(async () => {
			expect(test.state.contextMenu.open).toBe(false);
		});
		await test.openMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'exportProject');
		expect(index).toBeGreaterThanOrEqual(0);
		test.state.contextMenu.highlightedItem = index;
		test.events.dispatch('mousedown', { x: 800, y: 400, stopPropagation: false });
		expect(test.exportProject).toHaveBeenCalledWith(expect.stringContaining('int value 1'), 'project.8f4e');
		expect(parseProjectSource(test.exportProject.mock.calls[0][0]).modules[0].code).toEqual(test.block.code);
		expect(test.saveProject).not.toHaveBeenCalled();
		expect(test.saveSession).not.toHaveBeenCalled();
	});

	it.each([
		{ mode: 'edit', modifier: 'ctrlKey' },
		{ mode: 'edit', modifier: 'metaKey' },
		{ mode: 'view', modifier: 'ctrlKey' },
		{ mode: 'view', modifier: 'metaKey' },
	] as const)(
		'starts saving synchronously from $modifier+S in $mode mode and reads the latest code',
		({ mode, modifier }) => {
			const test = setup(true, mode);
			test.block.code[1] = 'int value 42';
			const event = test.keydown('S', { [modifier]: true });
			expect(event.defaultPrevented).toBe(true);
			expect(test.saveProject).toHaveBeenCalledOnce();
			expect(test.saveProject).toHaveBeenCalledWith(expect.stringContaining('int value 42'), 'project.8f4e');
			expect(test.exportProject).not.toHaveBeenCalled();
			expect(test.saveSession).not.toHaveBeenCalled();
		}
	);

	it.each([{ key: 's' }, { key: 'x', ctrlKey: true }])(
		'leaves unrelated keys unhandled: $key',
		({ key, ...modifiers }) => {
			const test = setup();
			expect(test.keydown(key, modifiers).defaultPrevented).toBe(false);
			expect(test.saveProject).not.toHaveBeenCalled();
		}
	);

	it.each(['demo', 'demo.wasm', 'demo.8f4e'])('uses the configured filename %s', name => {
		const test = setup();
		test.state.editorConfig.export = { fileName: name };
		test.events.dispatch('saveProject');
		test.events.dispatch('exportProject');
		expect(test.saveProject).toHaveBeenCalledWith(expect.any(String), 'demo.8f4e');
		expect(test.exportProject).toHaveBeenCalledWith(expect.any(String), 'demo.8f4e');
	});

	it('serializes the root project and nested groups while viewing a nested slice', () => {
		const test = setup();
		const nested = createMockCodeBlock({
			code: ['module voice', 'moduleEnd'],
			blockType: 'module',
			entry: 'main',
			creationIndex: 2,
		});
		const note = createMockCodeBlock({
			code: ['note local.settings', '; @pos 4 8', 'noteEnd'],
			blockType: 'note',
			creationIndex: 3,
		});
		test.state.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({
				name: 'Audio',
				code: ['group Audio', 'groupEnd'],
				entry: 'main',
				nestedProjectCodeBlocks: [nested],
				creationIndex: 1,
			}),
			note
		);
		test.state.codeBlockRendering.codeBlocks = [nested];
		test.events.dispatch('saveProject');
		const project = parseProjectSource(test.saveProject.mock.calls[0][0]);
		expect(project.modules[0].code).toEqual(test.block.code);
		expect(project.groups[0].modules[0].code).toEqual(nested.code);
		expect(project.notes[0].code).toEqual(note.code);
	});

	it('reports incomplete source without invoking a file callback', () => {
		const test = setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		test.block.code = ['module unfinished'];
		test.events.dispatch('saveProject');
		expect(test.saveProject).not.toHaveBeenCalled();
		expect(test.state.console.logs.at(-1)).toMatchObject({ level: 'error', message: 'Failed to serialize project' });
	});

	it.each(['saveProject', 'exportProject'] as const)('reports %s failures through the editor log', async action => {
		const test = setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		test[action].mockRejectedValueOnce(new Error('disk full'));
		test.events.dispatch(action);
		await vi.waitFor(() =>
			expect(test.state.console.logs.at(-1)).toMatchObject({
				level: 'error',
				message: 'Failed to save project to file',
			})
		);
	});

	it('omits the feature when not installed and releases its menu, actions, and shortcut', async () => {
		const omitted = setup(false);
		await omitted.openMenu();
		expect(omitted.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(false);
		expect(omitted.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(false);
		const test = setup();
		test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(false);
		expect(test.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(false);
		test.events.dispatch('saveProject');
		test.events.dispatch('exportProject');
		expect(test.saveProject).not.toHaveBeenCalled();
		expect(test.exportProject).not.toHaveBeenCalled();
	});

	it('keeps shortcuts and callbacks isolated between editors', () => {
		const first = setup();
		const second = setup();
		first.keydown('s', { metaKey: true });
		expect(first.saveProject).toHaveBeenCalledOnce();
		expect(second.saveProject).not.toHaveBeenCalled();
		first.disposePlugin();
		second.keydown('s', { ctrlKey: true });
		expect(second.saveProject).toHaveBeenCalledOnce();
	});
});
