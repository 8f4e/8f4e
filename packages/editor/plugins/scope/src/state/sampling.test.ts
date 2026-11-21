import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Scope } from '../types';
import { createScopeSampler } from './sampling';

function createScope(sampleRate: number, elementIndex: number): Scope {
	return {
		key: String(elementIndex),
		x: 0,
		y: 0,
		width: 8,
		height: 128,
		minValue: -1,
		maxValue: 1,
		sampleRate,
		read: {
			address: { kind: 'fixed', byteAddress: elementIndex * 4 },
			elementIndex,
			spec: {
				valueType: 'float32',
				elementByteSize: 4,
				isInteger: false,
				minValue: -1,
				maxValue: 1,
			},
		},
		history: [],
	};
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
afterEach(() => vi.useRealTimers());

it('keeps one timer per rate and preserves its cadence while membership changes', () => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
	new Float32Array(memory.buffer).set([-1, 0, 1]);
	const getMemory = vi.fn(() => memory);
	const sampler = createScopeSampler(getMemory);
	const first = createScope(10, 0);
	const second = createScope(10, 1);
	const fast = createScope(20, 2);

	try {
		sampler.sync([first, fast]);
		expect(vi.getTimerCount()).toBe(2);
		vi.advanceTimersByTime(40);
		sampler.sync([first, second, fast]);
		expect(vi.getTimerCount()).toBe(2);

		vi.advanceTimersByTime(10);
		expect(fast.history).toEqual([1]);
		expect(first.history).toEqual([]);
		expect(second.history).toEqual([]);

		vi.advanceTimersByTime(50);
		expect(first.history).toEqual([-1]);
		expect(second.history).toEqual([0]);
		expect(fast.history).toEqual([1, 1]);
		expect(getMemory).toHaveBeenCalledTimes(3);

		vi.advanceTimersByTime(40);
		sampler.sync([second]);
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(60);
		expect(first.history).toEqual([-1]);
		expect(second.history).toEqual([0, 0]);
		expect(fast.history).toEqual([1, 1]);
		expect(getMemory).toHaveBeenCalledTimes(4);

		sampler.sync([]);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(200);
		expect(getMemory).toHaveBeenCalledTimes(4);

		sampler.sync([second, fast]);
		expect(vi.getTimerCount()).toBe(2);
	} finally {
		sampler.dispose();
	}
	expect(vi.getTimerCount()).toBe(0);
});
