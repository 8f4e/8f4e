import { expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { createKeyboardEditingPlugin } from './index';

const { importEditing, handleKeydown } = vi.hoisted(() => ({ importEditing: vi.fn(), handleKeydown: vi.fn() }));
vi.mock('./editing', async () => {
	await importEditing();
	return { handleKeydown };
});

it('loads on edit mode, preserves input order, and discards stale input per editor', async () => {
	let finish!: () => void;
	importEditing.mockReturnValue(
		new Promise<void>(resolve => {
			finish = resolve;
		})
	);
	const live = setup(createKeyboardEditingPlugin, 'view');
	await Promise.resolve();
	expect(importEditing).not.toHaveBeenCalled();
	live.store.set('editorMode', 'edit');
	const observed: string[] = [];
	const observe = (event: Event) =>
		observed.push(event.type === 'blur' ? 'blur' : `${event.type}:${(event as KeyboardEvent).key}`);
	for (const type of ['keydown', 'keyup', 'blur']) live.inputTarget.addEventListener(type, observe);
	live.key('a');
	live.keyUp('a');
	live.key('ArrowLeft');
	live.blur();
	live.key('Escape');
	expect(observed).toEqual([]);
	const disposed = setup(createKeyboardEditingPlugin);
	const releasedAfterDisposal = vi.fn();
	disposed.inputTarget.addEventListener('keyup', releasedAfterDisposal);
	disposed.key('b');
	disposed.keyUp('previously-held');
	disposed.disposePlugin();
	expect(releasedAfterDisposal).toHaveBeenCalledOnce();
	const exited = setup(createKeyboardEditingPlugin);
	const blurredAfterExit = vi.fn();
	exited.inputTarget.addEventListener('blur', blurredAfterExit);
	exited.key('c');
	exited.blur();
	exited.store.set('editorMode', 'view');
	expect(blurredAfterExit).toHaveBeenCalledOnce();
	const replaced = setup(createKeyboardEditingPlugin);
	replaced.key('d');
	replaced.store.set('projectChange', { revision: 10, kind: 'replace' });
	expect(handleKeydown).not.toHaveBeenCalled();
	await vi.waitFor(() => expect(importEditing).toHaveBeenCalledOnce());
	finish();
	await vi.waitFor(() => expect(handleKeydown).toHaveBeenCalledTimes(3));
	expect(handleKeydown.mock.calls.map(([event]) => event.key)).toEqual(['a', 'ArrowLeft', 'Escape']);
	expect(handleKeydown.mock.calls.every(([event]) => !event.defaultPrevented)).toBe(true);
	expect(observed).toEqual(['keydown:a', 'keyup:a', 'keydown:ArrowLeft', 'blur', 'keydown:Escape']);
	live.store.set('editorMode', 'view');
	live.key('x');
	expect(handleKeydown).toHaveBeenCalledTimes(3);
	live.store.set('editorMode', 'edit');
	live.key('y');
	expect(handleKeydown).toHaveBeenCalledTimes(4);
	live.disposePlugin();
	live.key('z');
	expect(handleKeydown).toHaveBeenCalledTimes(4);
});
