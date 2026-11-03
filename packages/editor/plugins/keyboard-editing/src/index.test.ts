import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrawingContext } from './__tests__/drawing';
import { setup } from './__tests__/setup';

let createKeyboardEditingPlugin: typeof import('./index')['createKeyboardEditingPlugin'];

let finish: () => void;
let importEditing: ReturnType<typeof vi.fn<() => void>>;
let drawCaret: ReturnType<typeof vi.fn<typeof import('./editing')['drawCaret']>>;
let handleKeydown: ReturnType<typeof vi.fn<typeof import('./editing')['handleKeydown']>>;
beforeEach(async () => {
	vi.resetModules();
	importEditing = vi.fn();
	handleKeydown = vi.fn();
	drawCaret = vi.fn();
	const pending = new Promise<void>(resolve => {
		finish = resolve;
	});
	vi.doMock('./editing', async () => {
		importEditing();
		await pending;
		return { handleKeydown, drawCaret };
	});
	({ createKeyboardEditingPlugin } = await import('./index'));
});
afterEach(async () => {
	finish();
	await vi.dynamicImportSettled();
	vi.doUnmock('./editing');
});

async function finishLoading() {
	await vi.waitFor(() => expect(importEditing).toHaveBeenCalledOnce());
	finish();
	await vi.dynamicImportSettled();
}

describe('lazy keyboard editing input bridge', () => {
	it('waits for entry into edit mode before importing', async () => {
		const test = setup(createKeyboardEditingPlugin, 'view');
		await Promise.resolve();
		expect(importEditing).not.toHaveBeenCalled();
		test.events.dispatch('enterEditMode');
		await finishLoading();
	});
	it('loads when installed in edit mode', async () => {
		setup(createKeyboardEditingPlugin);
		await finishLoading();
	});
	it('replays presses, releases, and focus loss through the target in order', async () => {
		const test = setup(createKeyboardEditingPlugin);
		const observed: string[] = [];
		const observe = (event: Event) =>
			observed.push(event.type === 'blur' ? 'blur' : `${event.type}:${(event as KeyboardEvent).key}`);
		for (const type of ['keydown', 'keyup', 'blur']) test.inputTarget.addEventListener(type, observe);
		test.key('a');
		test.keyUp('a');
		test.key('ArrowLeft');
		test.blur();
		test.key('Escape');
		expect(observed).toEqual([]);
		await finishLoading();
		expect(observed).toEqual(['keydown:a', 'keyup:a', 'keydown:ArrowLeft', 'blur', 'keydown:Escape']);
		expect(handleKeydown.mock.calls.map(([event]) => event.key)).toEqual(['a', 'ArrowLeft', 'Escape']);
		expect(handleKeydown.mock.calls.every(([event]) => !event.defaultPrevented)).toBe(true);
	});
	it.each(['mode exit', 'project replacement', 'disposal'])(
		'discards pending presses but delivers releases on %s',
		async reason => {
			const test = setup(createKeyboardEditingPlugin);
			const onRelease = vi.fn();
			const onBlur = vi.fn();
			test.inputTarget.addEventListener('keyup', onRelease);
			test.inputTarget.addEventListener('blur', onBlur);
			test.key('a');
			test.keyUp('previously-held');
			test.blur();
			if (reason === 'mode exit') test.events.dispatch('exitToViewMode');
			else if (reason === 'project replacement')
				test.events.dispatch('loadProject', {
					project: {
						...EMPTY_DEFAULT_PROJECT,
						execution: [
							{ type: 'module', id: 0, entry: 'main', code: ['module replacement', '; @mode edit', 'moduleEnd'] },
						],
					},
				});
			else test.disposePlugin();
			expect(onRelease).toHaveBeenCalledOnce();
			expect(onBlur).toHaveBeenCalledOnce();
			await finishLoading();
			expect(handleKeydown).not.toHaveBeenCalled();
		}
	);
	it('reuses the loaded implementation across mode changes and ignores view-mode input', async () => {
		const test = setup(createKeyboardEditingPlugin);
		await finishLoading();
		test.events.dispatch('exitToViewMode');
		test.key('x');
		expect(handleKeydown).not.toHaveBeenCalled();
		test.events.dispatch('enterEditMode');
		test.key('y');
		expect(handleKeydown).toHaveBeenCalledOnce();
		expect(importEditing).toHaveBeenCalledOnce();
	});
	it('isolates pending input and disposal across editor instances', async () => {
		const first = setup(createKeyboardEditingPlugin);
		await vi.waitFor(() => expect(importEditing).toHaveBeenCalledOnce());
		const second = setup(createKeyboardEditingPlugin);
		first.key('a');
		second.key('b');
		first.disposePlugin();
		await finishLoading();
		expect(handleKeydown.mock.calls.map(([event]) => event.key)).toEqual(['b']);
	});
	it('draws through its foreground registration only after loading and unregisters on disposal', async () => {
		const test = setup(createKeyboardEditingPlugin);
		const { context } = createDrawingContext(test.state, test.block);
		test.drawForeground(context);
		expect(drawCaret).not.toHaveBeenCalled();
		await finishLoading();
		test.drawForeground(context);
		expect(drawCaret).toHaveBeenCalledWith(context);
		test.disposePlugin();
		test.drawForeground(context);
		expect(drawCaret).toHaveBeenCalledOnce();
	});
	it('removes its input listener after the implementation has loaded', async () => {
		const test = setup(createKeyboardEditingPlugin);
		await finishLoading();
		test.disposePlugin();
		test.key('a');
		expect(handleKeydown).not.toHaveBeenCalled();
	});
});
