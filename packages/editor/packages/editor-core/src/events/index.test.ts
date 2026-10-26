import { describe, expect, it, vi } from 'vitest';
import createEventDispatcher from './index';

describe('event dispatcher', () => {
	it('runs capture listeners before ordinary listeners while preserving registration order in each phase', () => {
		const events = createEventDispatcher();
		const calls: string[] = [];
		events.on('mousemove', () => calls.push('normal first'));
		events.on('mousemove', () => calls.push('capture first'), { capture: true });
		events.on('mousemove', () => calls.push('normal second'));
		events.on('mousemove', () => calls.push('capture second'), { capture: true });
		events.dispatch('mousemove');
		expect(calls).toEqual(['capture first', 'capture second', 'normal first', 'normal second']);
	});
	it('lets a capture listener consume an event and unregister normally', () => {
		const events = createEventDispatcher();
		const normal = vi.fn();
		const capture = (event: { stopPropagation: boolean }) => {
			event.stopPropagation = true;
		};
		events.on('mousemove', normal);
		events.on('mousemove', capture, { capture: true });
		events.dispatch('mousemove', { stopPropagation: false });
		expect(normal).not.toHaveBeenCalled();
		events.off('mousemove', capture);
		events.dispatch('mousemove', { stopPropagation: false });
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
