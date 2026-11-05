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
	it('visits higher UI layers first and handlers within a layer in reverse registration order', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('input', () => calls.push('ordinary first'));
		events.on('input', () => calls.push('overlay first'), { layer: 2, capture: true });
		events.on('input', () => calls.push('dialog'), { layer: 4 });
		events.on('input', () => calls.push('overlay last'), { layer: 2, capture: true });
		events.on('input', () => calls.push('block'), { layer: 0, capture: true });
		events.on('input', () => calls.push('menu'), { layer: 3 });
		events.on('input', () => calls.push('ordinary last'));
		events.dispatch('input');
		expect(calls).toEqual([
			'dialog',
			'menu',
			'overlay last',
			'overlay first',
			'block',
			'ordinary first',
			'ordinary last',
		]);
	});

	it('lets a late UI handler consume input and unregisters it without affecting other layers', () => {
		const events = createEventDispatcher();
		const lower = vi.fn();
		const earlier = vi.fn();
		const ordinary = vi.fn();
		const consume = (event: { stopPropagation: boolean }) => {
			event.stopPropagation = true;
		};
		events.on('input', earlier, { capture: true, layer: 2 });
		events.on('input', lower, { capture: true, layer: 0 });
		events.on('input', ordinary);
		events.on('input', consume, { capture: true, layer: 2 });
		events.dispatch('input', { stopPropagation: false });
		expect(earlier).not.toHaveBeenCalled();
		expect(lower).not.toHaveBeenCalled();
		expect(ordinary).not.toHaveBeenCalled();
		events.off('input', consume);
		events.dispatch('input', { stopPropagation: false });
		expect(earlier).toHaveBeenCalledOnce();
		expect(lower).toHaveBeenCalledOnce();
		expect(ordinary).toHaveBeenCalledOnce();
	});

	it('honors capture-only probes inside UI layers without running normal activation handlers', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('input', () => calls.push('normal'), { layer: 3 });
		events.on('input', () => calls.push('capture first'), { layer: 2, capture: true });
		events.on('input', () => calls.push('capture last'), { layer: 2, capture: true });
		events.dispatch('input', undefined, { phase: 'capture' });
		expect(calls).toEqual(['capture last', 'capture first']);
	});

	it('retains ordinary notification registration order when capture adds a normal listener', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('notice', () => events.on('notice', () => calls.push('added')), { capture: true });
		events.on('notice', () => calls.push('existing'));
		events.dispatch('notice');
		expect(calls).toEqual(['existing', 'added']);
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
