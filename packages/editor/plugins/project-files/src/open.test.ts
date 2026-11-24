import { expect, it, vi } from 'vitest';
import { setup, source } from './__tests__/setup';
import { createProjectFilesPlugin } from './index';

it.each(['edit', 'view'] as const)('opens from the contributed menu in %s mode', async mode => {
	const test = setup({ mode });
	await test.openMenu();
	const index = test.state.contextMenu.items.findIndex(item => item.action === 'importProject');
	expect(index).toBeGreaterThanOrEqual(0);
	const original = test.state.project.rootLevel;
	await test.events.dispatchAsync('activateContextMenuItem', { index, x: 800, y: 400 });
	await vi.waitFor(() =>
		expect(test.state.loadingIndicators.find(indicator => indicator.id === 'project-file')?.status).toBe('done')
	);
	expect(test.state.project.rootLevel).not.toBe(original);
	expect(test.state.project.activeLevel.blocks.find(block => block.name === 'test')!.code).toContain('int value 1');
	expect(test.state.contextMenu.open).toBe(false);
	expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	await test.events.dispatchAsync('saveProject');
	expect(test.handle.writable.close).toHaveBeenCalledOnce();
	expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
});

it('hides the menu item without removing the import action', async () => {
	const test = setup({
		createPlugin: inputTarget => createProjectFilesPlugin({ inputTarget, showOpenMenuItem: false }),
	});
	await test.openMenu();
	expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
	await test.events.dispatchAsync('importProject');
	await test.events.dispatchAsync('saveProject');
	expect(test.handle.writable.close).toHaveBeenCalledOnce();
	expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
});

it.each(['getFile', 'parse', 'cancel'])(
	'preserves the project and file association after %s failure',
	async failure => {
		const test = setup();
		await test.events.dispatchAsync('importProject');
		const original = test.state.project.rootLevel;
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
		expect(test.state.project.rootLevel).toBe(original);
		if (failure === 'cancel') expect(test.state.console.logs).toEqual([]);
		else expect(test.state.console.logs.at(-1)?.message).toContain('Failed to open project');
		await test.events.dispatchAsync('saveProject');
		expect(test.handle.requestPermission).toHaveBeenCalledOnce();
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
	}
);

it.each(['change', 'cancel'])('handles file input %s when the picker is unavailable', async action => {
	const test = setup();
	await test.events.dispatchAsync('importProject');
	const original = test.state.project.rootLevel;
	Reflect.deleteProperty(test.browserWindow, 'showOpenFilePicker');
	const pending = test.events.dispatchAsync('importProject');
	expect(test.document.createElement).toHaveBeenCalledWith('input');
	expect(test.input.click).toHaveBeenCalledOnce();
	expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	test.input.dispatchEvent(new Event(action));
	await pending;
	if (action === 'change') expect(test.state.project.rootLevel).not.toBe(original);
	else expect(test.state.project.rootLevel).toBe(original);
	await test.events.dispatchAsync('saveProject');
	expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(action === 'change' ? 1 : 0);
	expect(test.handle.requestPermission).toHaveBeenCalledTimes(action === 'change' ? 0 : 1);
});

it('ignores an open that finishes after disposal', async () => {
	const test = setup();
	let finish!: (source: string) => void;
	const file = new File([source], 'test.8f4e');
	vi.spyOn(file, 'text').mockReturnValueOnce(
		new Promise(resolve => {
			finish = resolve;
		})
	);
	test.handle.getFile.mockResolvedValueOnce(file);
	const original = test.state.project.rootLevel;
	const pending = test.events.dispatchAsync('importProject');
	await vi.waitFor(() =>
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'project-file', message: 'Loading project...', status: 'loading' },
		])
	);
	test.disposePlugin();
	expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	finish(source);
	await pending;
	expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	expect(test.state.project.rootLevel).toBe(original);
});

it('removes its menu and action on disposal and is absent when not installed', async () => {
	for (const installed of [true, false]) {
		const test = installed ? setup() : setup({ createPlugin: () => undefined });
		test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
		await test.events.dispatchAsync('importProject');
		expect(test.browserWindow.showOpenFilePicker).not.toHaveBeenCalled();
	}
});
