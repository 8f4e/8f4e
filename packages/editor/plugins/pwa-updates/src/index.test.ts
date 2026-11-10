import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import { afterEach, expect, it, vi } from 'vitest';
import { createPwaUpdatesPlugin } from './index';

class Worker extends EventTarget {
	state: ServiceWorkerState = 'installing';
	postMessage = vi.fn();
}

class Registration extends EventTarget {
	waiting: Worker | null = null;
	installing: Worker | null = null;
}

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(registration = new Registration(), ready = Promise.resolve(registration)) {
	const emitter = new EventEmitter();
	const dispatch = vi.fn((name: string, payload?: unknown) => emitter.emit(name, payload));
	const removeMenu = vi.fn();
	const registerItem = vi.fn((_slot: string, _provider: () => unknown) => removeMenu);
	const dispose = createPwaUpdatesPlugin({
		serviceWorker: { ready: ready as unknown as Promise<ServiceWorkerRegistration> },
	}).setup({
		events: { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch },
		menus: { registerItem },
	} as unknown as EditorPluginContext);
	cleanups.push(dispose);
	return {
		registration,
		dispatch,
		removeMenu,
		menu: () => registerItem.mock.calls[0][1](),
		dialogs: () => dispatch.mock.calls.filter(([name]) => name === 'addDialog'),
		dispose,
	};
}

it('keeps the initial installation silent', async () => {
	const test = setup();
	await Promise.resolve();
	expect(test.dialogs()).toEqual([]);
	expect(test.menu()).toBeUndefined();
	test.dispatch('applyPwaUpdate');
	expect(test.dialogs()).toEqual([]);
});

it('shows an already waiting update without activating it', async () => {
	const registration = new Registration();
	const waiting = new Worker();
	registration.waiting = waiting;
	const test = setup(registration);
	await Promise.resolve();
	expect(test.dialogs()).toEqual([
		[
			'addDialog',
			{
				id: 'pwa-update',
				title: 'Update available',
				text: expect.stringContaining('all open 8f4e windows'),
				buttons: [{ title: 'Reload', action: 'applyPwaUpdate' }, { title: 'Later' }],
			},
		],
	]);
	expect(waiting.postMessage).not.toHaveBeenCalled();
	expect(test.menu()).toEqual({ title: 'Reload to update', action: 'showPwaUpdate', close: true });
	test.dispatch('showPwaUpdate');
	expect(test.dialogs()).toHaveLength(2);
	test.dispatch('applyPwaUpdate');
	test.dispatch('applyPwaUpdate');
	expect(waiting.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' });
});

it('announces each new waiting worker once and stops observing replaced installations', async () => {
	const test = setup();
	await Promise.resolve();
	const old = new Worker();
	test.registration.installing = old;
	test.registration.dispatchEvent(new Event('updatefound'));
	expect(test.dialogs()).toEqual([]);
	const current = new Worker();
	test.registration.installing = current;
	test.registration.dispatchEvent(new Event('updatefound'));
	test.registration.waiting = current;
	old.dispatchEvent(new Event('statechange'));
	expect(test.dialogs()).toEqual([]);
	current.state = 'installed';
	current.dispatchEvent(new Event('statechange'));
	current.dispatchEvent(new Event('statechange'));
	expect(test.dialogs()).toHaveLength(1);
	test.dispose();
	const count = test.dispatch.mock.calls.length;
	current.dispatchEvent(new Event('statechange'));
	test.registration.dispatchEvent(new Event('updatefound'));
	test.dispatch('applyPwaUpdate');
	expect(test.dispatch.mock.calls).toHaveLength(count + 1);
	expect(current.postMessage).not.toHaveBeenCalled();
	expect(test.removeMenu).toHaveBeenCalledOnce();
	expect(test.dispatch).toHaveBeenCalledWith('removeDialog', { id: 'pwa-update' });
});

it('ignores a registration that becomes ready after disposal', async () => {
	const registration = new Registration();
	registration.waiting = new Worker();
	let resolve!: (registration: Registration) => void;
	const ready = new Promise<Registration>(done => {
		resolve = done;
	});
	const test = setup(registration, ready);
	test.dispose();
	resolve(registration);
	await Promise.resolve();
	expect(test.dialogs()).toEqual([]);
	expect(test.menu()).toBeUndefined();
	expect(registration.waiting.postMessage).not.toHaveBeenCalled();
});
