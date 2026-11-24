import { parseProjectSource } from '@8f4e/compiler';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { describe, expect, it, vi } from 'vitest';
import { createHandle, setup } from './__tests__/setup';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(complete => {
		resolve = complete;
	});
	return { promise, resolve };
}
describe('project file saving', () => {
	it('saves and exports without opening a file first', async () => {
		const test = setup();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true);
		expect(test.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(true);
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(test.handle.writable.close).toHaveBeenCalledOnce());
		await test.events.dispatchAsync('exportProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(2);
		expect(await test.handle.writable.write.mock.calls[1][0].text()).toContain('int value 1');
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
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		picked.resolve(test.handle);
		await save;
		expect(test.handle.writable.close).toHaveBeenCalledOnce();
		await test.events.dispatchAsync('saveProject');
		expect(test.browserWindow.showSaveFilePicker).toHaveBeenCalledTimes(2);
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
	it('serializes the whole root project while viewing a group', async () => {
		const test = setup();
		const nested = createMockCodeBlock({
			code: ['module voice', 'moduleEnd'],
			blockType: 'module',
			entry: 'main',
			creationIndex: 2,
		});
		test.state.project.rootLevel.blocks.push(
			createMockCodeBlock({
				name: 'Audio',
				code: ['group Audio', 'groupEnd'],
				entry: 'main',
				childLevel: { entries: [], path: '', blocks: [nested] },
				creationIndex: 1,
			})
		);
		test.state.project.activeLevel = test.state.project.rootLevel.blocks.find(block => block.name === 'Audio')!
			.childLevel!;
		await test.events.dispatchAsync('saveProject');
		const project = parseProjectSource(await test.handle.writable.write.mock.calls[0][0].text());
		expect(getProjectModules(project)[0].code).toContain('int value 1');
		expect(getProjectModules(getProjectGroups(project)[0])[0].code).toEqual(nested.code);
	});
	it.each(['saveProject', 'exportProject'])('reports incomplete source before %s opens a picker', async action => {
		const test = setup();
		test.state.project.rootLevel.blocks.find(block => block.name === 'test')!.code = ['module unfinished'];
		await test.events.dispatchAsync(action);
		expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
		expect(test.state.console.logs.at(-1)?.message).toContain('Failed to serialize project');
	});
});

it('removes its menu, commands, and shortcut on disposal', async () => {
	const test = setup();
	test.disposePlugin();
	await test.openMenu();
	expect(test.state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(false);
	expect(test.keydown('s', { ctrlKey: true }).defaultPrevented).toBe(false);
	await test.events.dispatchAsync('saveProject');
	await test.events.dispatchAsync('exportProject');
	expect(test.browserWindow.showSaveFilePicker).not.toHaveBeenCalled();
});
