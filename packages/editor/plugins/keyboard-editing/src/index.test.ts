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
	live.key('a');
	live.key('ArrowLeft');
	live.key('Escape');
	const disposed = setup(createKeyboardEditingPlugin);
	disposed.key('b');
	disposed.disposePlugin();
	const exited = setup(createKeyboardEditingPlugin);
	exited.key('c');
	exited.store.set('editorMode', 'view');
	const replaced = setup(createKeyboardEditingPlugin);
	replaced.key('d');
	replaced.store.set('projectChange', { revision: 10, kind: 'replace' });
	expect(handleKeydown).not.toHaveBeenCalled();
	await vi.waitFor(() => expect(importEditing).toHaveBeenCalledOnce());
	finish();
	await vi.waitFor(() => expect(handleKeydown).toHaveBeenCalledTimes(3));
	expect(handleKeydown.mock.calls.map(([event]) => event.key)).toEqual(['a', 'ArrowLeft', 'Escape']);
	expect(handleKeydown.mock.calls.every(([event]) => !event.defaultPrevented)).toBe(true);
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
