import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createWasmExportPlugin } from './index';

const cleanups: Array<() => void> = [];
function setup(installed = true, initialEditorMode: 'view' | 'edit' = 'edit') {
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
		runtimeRegistry: {},
		initialEditorMode,
	});
	const exportBinaryCode = vi.fn<(fileName: string) => Promise<void>>().mockResolvedValue(undefined);
	const disposePlugin = installed
		? createWasmExportPlugin({ exportBinaryCode }).setup({
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
	const openMenu = async () => {
		events.dispatch('contextmenu', { x: 80, y: 80 });
		await Promise.resolve();
	};
	return { events, store, state: store.getState(), exportBinaryCode, disposePlugin, openMenu };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('WebAssembly export plugin', () => {
	it.each(['view', 'edit'] as const)('exports through the main menu in %s mode', async mode => {
		const test = setup(true, mode);
		test.exportBinaryCode.mockImplementation(async () => {
			expect(test.state.contextMenu.open).toBe(false);
		});
		await test.openMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'exportWasm');
		expect(index).toBeGreaterThanOrEqual(0);
		test.state.contextMenu.highlightedItem = index;
		test.events.dispatch('mousedown', { x: 80, y: 80, stopPropagation: false });
		expect(test.exportBinaryCode).toHaveBeenCalledWith('project.wasm');
	});
	it.each(['demo', 'demo.wasm', 'demo.8f4e'])('uses the configured filename %s', name => {
		const test = setup();
		test.state.editorConfig.export = { fileName: name };
		test.events.dispatch('exportWasm');
		expect(test.exportBinaryCode).toHaveBeenCalledWith('demo.wasm');
	});
	it('reports export failures', async () => {
		const test = setup();
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const error = new Error('disk full');
		test.exportBinaryCode.mockRejectedValueOnce(error);
		test.events.dispatch('exportWasm');
		await vi.waitFor(() => expect(report).toHaveBeenCalledWith('Failed to export WebAssembly file:', error));
	});
	it('omits the feature when not installed and releases its menu and action', async () => {
		const omitted = setup(false);
		await omitted.openMenu();
		expect(omitted.state.contextMenu.items.some(item => item.action === 'exportWasm')).toBe(false);
		const test = setup();
		test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'exportWasm')).toBe(false);
		test.events.dispatch('exportWasm');
		expect(test.exportBinaryCode).not.toHaveBeenCalled();
	});
	it('keeps export callbacks isolated between editors', () => {
		const first = setup();
		const second = setup();
		first.events.dispatch('exportWasm');
		expect(first.exportBinaryCode).toHaveBeenCalledOnce();
		expect(second.exportBinaryCode).not.toHaveBeenCalled();
	});
});
