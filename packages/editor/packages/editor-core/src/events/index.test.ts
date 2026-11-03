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
