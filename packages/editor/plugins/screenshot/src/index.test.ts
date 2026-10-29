import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createScreenshotPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(installed = true, initialEditorMode: 'edit' | 'view' = 'edit') {
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
		initialEditorMode,
	});
	const state = store.getState();
	const blob = new Blob(['png'], { type: 'image/png' });
	const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
	const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: async () => writable });
	const link = { click: vi.fn(), remove: vi.fn(), style: {}, href: '', download: '' };
	const createObjectURL = vi.fn().mockReturnValue('blob:screenshot');
	const revokeObjectURL = vi.fn();
	const document = {
		defaultView: { showSaveFilePicker, URL: { createObjectURL, revokeObjectURL } },
		createElement: vi.fn().mockReturnValue(link),
		body: { appendChild: vi.fn() },
	};
	const toBlob = vi.fn<HTMLCanvasElement['toBlob']>(callback => callback(blob));
	const canvas = { ownerDocument: document, toBlob } as unknown as HTMLCanvasElement;
	const renderFrame = vi.fn();
	const plugin = createScreenshotPlugin({ canvas, renderFrame });
	const disposePlugin = installed
		? plugin.setup({
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
	const openMainMenu = async () => {
		events.dispatch('contextmenu', { x: 80, y: 80 });
		await Promise.resolve();
	};
	const takeScreenshot = () => events.dispatch('exportCanvasScreenshot');
	return {
		state,
		store,
		events,
		blob,
		canvas,
		toBlob,
		writable,
		showSaveFilePicker,
		link,
		document,
		createObjectURL,
		revokeObjectURL,
		renderFrame,
		disposePlugin,
		openMainMenu,
		takeScreenshot,
	};
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('screenshot plugin', () => {
	it.each(['edit', 'view'] as const)('captures a fresh frame with the menu closed in %s mode', async mode => {
		const test = setup(true, mode);
		test.renderFrame.mockImplementation(() => {
			expect(test.state.contextMenu.open).toBe(false);
			expect(test.state.featureFlags.modeOverlay).toBe(false);
			expect(test.state.featureFlags.offscreenBlockArrows).toBe(false);
		});
		await test.openMainMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'exportCanvasScreenshot');
		expect(index).toBeGreaterThanOrEqual(0);
		expect(test.state.contextMenu.items[index].disabled).toBeUndefined();
		test.state.contextMenu.highlightedItem = index;
		test.events.dispatch('mousedown', { x: 80, y: 80, stopPropagation: false });
		expect(test.renderFrame).toHaveBeenCalledOnce();
		expect(test.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
		expect(test.renderFrame.mock.invocationCallOrder[0]).toBeLessThan(test.toBlob.mock.invocationCallOrder[0]);
		await vi.waitFor(() => expect(test.state.featureFlags.modeOverlay).toBe(true));
		expect(test.writable.write).toHaveBeenCalledWith(test.blob);
		expect(test.writable.close).toHaveBeenCalledOnce();
		expect(test.state.featureFlags.offscreenBlockArrows).toBe(true);
	});

	it.each([
		{ name: undefined, expected: 'project.png' },
		{ name: 'demo', expected: 'demo.png' },
		{ name: 'demo.8f4e', expected: 'demo.png' },
		{ name: 'demo.wasm', expected: 'demo.png' },
	])('uses the configured export name $name', async ({ name, expected }) => {
		const test = setup();
		test.state.editorConfig.export = { fileName: name };
		test.takeScreenshot();
		expect(test.showSaveFilePicker).toHaveBeenCalledWith({
			suggestedName: expected,
			types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
		});
		await vi.waitFor(() => expect(test.writable.close).toHaveBeenCalledOnce());
	});

	it('opens the picker before waiting for PNG encoding', async () => {
		const test = setup();
		let finishEncoding!: BlobCallback;
		test.toBlob.mockImplementation(callback => {
			finishEncoding = callback;
		});
		test.takeScreenshot();
		expect(test.showSaveFilePicker).toHaveBeenCalledOnce();
		expect(test.showSaveFilePicker.mock.invocationCallOrder[0]).toBeLessThan(test.toBlob.mock.invocationCallOrder[0]);
		expect(test.writable.write).not.toHaveBeenCalled();
		finishEncoding(test.blob);
		await vi.waitFor(() => expect(test.writable.close).toHaveBeenCalledOnce());
	});

	it('uses the canvas document for downloads when the save picker is unavailable', async () => {
		const test = setup();
		Reflect.deleteProperty(test.document.defaultView, 'showSaveFilePicker');
		test.takeScreenshot();
		await vi.waitFor(() => expect(test.state.featureFlags.modeOverlay).toBe(true));
		expect(test.createObjectURL).toHaveBeenCalledWith(test.blob);
		expect(test.document.createElement).toHaveBeenCalledWith('a');
		expect(test.link.href).toBe('blob:screenshot');
		expect(test.link.download).toBe('project.png');
		expect(test.link.click).toHaveBeenCalledOnce();
		expect(test.link.remove).toHaveBeenCalledOnce();
		expect(test.revokeObjectURL).toHaveBeenCalledWith('blob:screenshot');
	});

	it.each(['encoding', 'saving', 'rendering'] as const)('restores the previous flags after %s fails', async stage => {
		const test = setup();
		test.store.set('featureFlags.offscreenBlockArrows', false);
		const error = new Error('Screenshot failed');
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		if (stage === 'encoding') test.toBlob.mockImplementation(callback => callback(null));
		if (stage === 'saving') test.writable.write.mockRejectedValueOnce(error);
		if (stage === 'rendering')
			test.renderFrame.mockImplementationOnce(() => {
				throw error;
			});
		test.takeScreenshot();
		await vi.waitFor(() =>
			expect(report).toHaveBeenCalledWith('Failed to export canvas screenshot:', expect.any(Error))
		);
		expect(test.state.featureFlags.modeOverlay).toBe(true);
		expect(test.state.featureFlags.offscreenBlockArrows).toBe(false);
	});

	it('contributes nothing when omitted and removes its menu and handler on disposal', async () => {
		const omitted = setup(false);
		await omitted.openMainMenu();
		expect(omitted.state.contextMenu.items.some(item => item.action === 'exportCanvasScreenshot')).toBe(false);
		const installed = setup();
		installed.disposePlugin();
		await installed.openMainMenu();
		installed.takeScreenshot();
		expect(installed.state.contextMenu.items.some(item => item.action === 'exportCanvasScreenshot')).toBe(false);
		expect(installed.renderFrame).not.toHaveBeenCalled();
		expect(installed.toBlob).not.toHaveBeenCalled();
	});

	it('keeps browser resources and state isolated between editors', async () => {
		const first = setup();
		const second = setup();
		first.takeScreenshot();
		expect(second.renderFrame).not.toHaveBeenCalled();
		expect(second.toBlob).not.toHaveBeenCalled();
		expect(second.state.featureFlags.modeOverlay).toBe(true);
		await vi.waitFor(() => expect(first.writable.close).toHaveBeenCalledOnce());
		first.disposePlugin();
		second.takeScreenshot();
		await vi.waitFor(() => expect(second.writable.close).toHaveBeenCalledOnce());
		expect(first.toBlob).toHaveBeenCalledOnce();
	});
});
