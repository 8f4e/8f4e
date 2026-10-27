import { describe, expect, it } from 'vitest';
import { createMemory } from '../__tests__/memory';
import formatWatchValue, { formatWatchValueAtAddress } from './formatWatchValue';

function createMemoryViews() {
	const buffer = new ArrayBuffer(8);

	return {
		uint8: new Uint8Array(buffer),
		int8: new Int8Array(buffer),
		uint16: new Uint16Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
}

describe('formatWatchValue', () => {
	it('renders 32-bit hex values as separate bytes in big-endian display order', () => {
		const memoryViews = createMemoryViews();
		memoryViews.uint8.set([0xff, 0xa8, 0x00, 0x00]);

		expect(formatWatchValue(memoryViews, createMemory({ elementWordSize: 4 }), 0, 'hex')).toBe('00 00 a8 ff');
	});

	it('preserves leading zero bytes for 16-bit hex values', () => {
		const memoryViews = createMemoryViews();
		memoryViews.uint8.set([0x0f, 0x00]);

		expect(
			formatWatchValue(memoryViews, createMemory({ elementWordSize: 2, allocationUnitCount: 0.5 }), 0, 'hex')
		).toBe('00 0f');
	});

	it('formats single-byte hex values as a padded byte', () => {
		const memoryViews = createMemoryViews();
		memoryViews.uint8[0] = 0x0a;

		expect(
			formatWatchValue(memoryViews, createMemory({ elementWordSize: 1, allocationUnitCount: 0.25 }), 0, 'hex')
		).toBe('0a');
	});

	it('renders an invalid marker for a negative dereferenced byte address', () => {
		const memoryViews = createMemoryViews();

		expect(
			formatWatchValueAtAddress(
				memoryViews,
				-1,
				-0.25,
				{ elementWordSize: 1, isInteger: true, isUnsigned: true },
				'decimal'
			)
		).toBe('?');
	});

	it('renders an invalid marker for an out-of-range watch index', () => {
		const memoryViews = createMemoryViews();

		expect(formatWatchValue(memoryViews, createMemory({ elementWordSize: 4 }), 2, 'decimal')).toBe('?');
	});

	it('renders an invalid marker for misaligned and truncated values', () => {
		const memoryViews = createMemoryViews();

		expect(
			formatWatchValueAtAddress(
				memoryViews,
				1,
				0,
				{ elementWordSize: 2, isInteger: true, isUnsigned: false },
				'decimal'
			)
		).toBe('?');
		expect(
			formatWatchValueAtAddress(memoryViews, 4, 1, { elementWordSize: 8, isInteger: false, isUnsigned: false }, 'hex')
		).toBe('?');
	});
});
