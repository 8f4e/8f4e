import { describe, expect, it, vi } from 'vitest';
import createEventDispatcher from './index';

describe('event dispatcher', () => {
	it.each(['capture', 'normal'] as const)('can deliver only the %s phase', phase => {
		const events = createEventDispatcher();
		const capture = vi.fn();
		const normal = vi.fn();
		events.on('pointerdown', capture, { capture: true });
		events.on('pointerdown', normal);
		events.dispatch('pointerdown', { stopPropagation: false }, { phase });
		expect(capture).toHaveBeenCalledTimes(phase === 'capture' ? 1 : 0);
		expect(normal).toHaveBeenCalledTimes(phase === 'normal' ? 1 : 0);
	});

	it('waits for asynchronous startup work while starting every listener immediately', async () => {
		const events = createEventDispatcher();
		let finish!: () => void;
		const pending = new Promise<void>(resolve => {
			finish = resolve;
		});
		const restore = vi.fn();
		const completed = vi.fn();
		events.on('init', async () => await pending);
		events.on('init', restore);
		const initializing = events.dispatchAsync('init').then(completed);
		expect(restore).toHaveBeenCalledOnce();
		await Promise.resolve();
		expect(completed).not.toHaveBeenCalled();
		finish();
		await initializing;
		expect(completed).toHaveBeenCalledOnce();
	});

	it('delivers disposal to every listener when a listener unregisters itself', () => {
		const events = createEventDispatcher();
		const first = () => events.off('dispose', first);
		const second = vi.fn();
		events.on('dispose', first);
		events.on('dispose', second);
		events.dispatch('dispose');
		expect(second).toHaveBeenCalledOnce();
	});
	it('runs capture listeners before ordinary listeners while preserving registration order in each phase', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('pointermove', () => calls.push('normal first'));
		events.on('pointermove', () => calls.push('capture first'), { capture: true });
		events.on('pointermove', () => calls.push('normal second'));
		events.on('pointermove', () => calls.push('capture second'), { capture: true });
		events.dispatch('pointermove');
		expect(calls).toEqual(['capture first', 'capture second', 'normal first', 'normal second']);
	});
	it('orders each phase by priority and retains registration order for ties', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('action', () => calls.push('default capture'), { capture: true });
		events.on('action', () => calls.push('normal high'), { priority: 100 });
		events.on('action', () => calls.push('capture high first'), { capture: true, priority: 1 });
		events.on('action', () => calls.push('capture low'), { capture: true, priority: -1 });
		events.on('action', () => calls.push('capture high second'), { capture: true, priority: 1 });
		events.dispatch('action');
		expect(calls).toEqual([
			'capture high first',
			'capture high second',
			'default capture',
			'capture low',
			'normal high',
		]);
	});

	it('lets a later high-priority listener stop earlier listeners and unregisters it normally', () => {
		const events = createEventDispatcher();
		const early = vi.fn();
		const consume = (event: { stopPropagation: boolean }) => {
			event.stopPropagation = true;
		};
		events.on('action', early, { capture: true });
		events.on('action', consume, { capture: true, priority: 1 });
		events.dispatch('action', { stopPropagation: false });
		expect(early).not.toHaveBeenCalled();
		events.off('action', consume);
		events.dispatch('action', { stopPropagation: false });
		expect(early).toHaveBeenCalledOnce();
	});

	it('lets a capture listener consume an event and unregister normally', () => {
		const events = createEventDispatcher();
		const normal = vi.fn();
		const capture = (event: { stopPropagation: boolean }) => {
			event.stopPropagation = true;
		};
		events.on('pointermove', normal);
		events.on('pointermove', capture, { capture: true });
		events.dispatch('pointermove', { stopPropagation: false });
		expect(normal).not.toHaveBeenCalled();
		events.off('pointermove', capture);
		events.dispatch('pointermove', { stopPropagation: false });
		expect(normal).toHaveBeenCalledOnce();
	});
	it('removes every subscription when disposed', () => {
		const events = createEventDispatcher();
		const first = vi.fn();
		const second = vi.fn();
		events.on('first', first);
		events.on('second', second, { capture: true });

		events.dispose();
		events.dispose();
		events.dispatch('first');
		events.dispatch('second');

		expect(first).not.toHaveBeenCalled();
		expect(second).not.toHaveBeenCalled();
	});
});
