import { describe, expect, it } from 'vitest';

import { createMemoryViewManager } from '../memoryViewManager';

describe('createMemoryViewManager', () => {
	it('creates a float64 view on initialization', () => {
		const buffer = new ArrayBuffer(64);
		const { memoryViews } = createMemoryViewManager(buffer);
		expect(memoryViews.float64).toBeInstanceOf(Float64Array);
		expect(memoryViews.float64.buffer).toBe(buffer);
	});

	it('refreshes float64 view when buffer identity changes', () => {
		const buffer1 = new ArrayBuffer(64);
		const buffer2 = new ArrayBuffer(64);
		const { memoryViews, updateMemoryViews } = createMemoryViewManager(buffer1);

		expect(memoryViews.float64.buffer).toBe(buffer1);

		updateMemoryViews(buffer2);
		expect(memoryViews.float64.buffer).toBe(buffer2);
	});

	it('does not recreate views when buffer identity is unchanged', () => {
		const buffer = new ArrayBuffer(64);
		const { memoryViews, updateMemoryViews } = createMemoryViewManager(buffer);

		const originalFloat64 = memoryViews.float64;
		updateMemoryViews(buffer);
		expect(memoryViews.float64).toBe(originalFloat64);
	});

	it('float64 view reads values written to the buffer', () => {
		const buffer = new ArrayBuffer(64);
		const writer = new Float64Array(buffer);
		writer[0] = 3.141592653589793;
		writer[1] = 2.718281828459045;

		const { memoryViews } = createMemoryViewManager(buffer);
		expect(memoryViews.float64[0]).toBeCloseTo(3.141592653589793);
		expect(memoryViews.float64[1]).toBeCloseTo(2.718281828459045);
	});
});
