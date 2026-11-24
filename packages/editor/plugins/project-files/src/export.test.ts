import { expect, it, vi } from 'vitest';
import { createHandle, setup } from './__tests__/setup';
import { createProjectExportPlugin } from './export';

it.each(['edit', 'view'] as const)('exports to a freshly picked destination in %s mode', async mode => {
	const test = setup({ mode, createPlugin: inputTarget => createProjectExportPlugin({ inputTarget }) });
	await test.openMenu();
	expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true);
	expect(test.state.contextMenu.items.some(item => item.action === 'importProject')).toBe(false);
	const other = createHandle();
	test.browserWindow.showSaveFilePicker.mockResolvedValueOnce(test.handle).mockResolvedValueOnce(other);
	await test.events.dispatchAsync('exportProject');
	expect(await test.handle.writable.write.mock.calls[0][0].text()).toContain('int value 1');
	test.setCode('latest code');
	expect(test.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(true);
	expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(2);
	await vi.waitFor(() => expect(other.writable.close).toHaveBeenCalledOnce());
	expect(await other.writable.write.mock.calls[0][0].text()).toContain('latest code');
	expect(test.handle.requestPermission).not.toHaveBeenCalled();
	expect(other.requestPermission).not.toHaveBeenCalled();
});

it('does not install Open or Save commands and cleans up its menu and shortcut', async () => {
	const test = setup({ createPlugin: inputTarget => createProjectExportPlugin({ inputTarget }) });
	await test.events.dispatchAsync('importProject');
	await test.events.dispatchAsync('saveProject');
	expect(test.browserWindow.showOpenFilePicker).not.toHaveBeenCalled();
	expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
	test.disposePlugin();
	await test.openMenu();
	expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(false);
	expect(test.keydown('s', { metaKey: true }).defaultPrevented).toBe(false);
	await test.events.dispatchAsync('exportProject');
	expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
});

it('downloads on each export when there is no save picker', async () => {
	const test = setup({ createPlugin: inputTarget => createProjectExportPlugin({ inputTarget }) });
	Reflect.deleteProperty(test.browserWindow, 'showSaveFilePicker');
	await test.events.dispatchAsync('exportProject');
	await test.events.dispatchAsync('exportProject');
	expect(test.link.download).toBe('project.8f4e');
	expect(test.link.click).toHaveBeenCalledTimes(2);
	expect(test.browserWindow.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it('ignores picker cancellation and reports failed writes', async () => {
	const test = setup({ createPlugin: inputTarget => createProjectExportPlugin({ inputTarget }) });
	test.browserWindow.showSaveFilePicker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
	await test.events.dispatchAsync('exportProject');
	expect(test.state.console.logs).toEqual([]);
	expect(test.handle.createWritable).not.toHaveBeenCalled();
	test.handle.writable.write.mockRejectedValueOnce(new Error('disk full'));
	await test.events.dispatchAsync('exportProject');
	expect(test.handle.writable.abort).toHaveBeenCalledOnce();
	expect(test.state.console.logs.at(-1)?.message).toContain('disk full');
});
