import { describe, expect, it } from 'vitest';
import { createMemory } from '../__tests__/memory';
import formatWatchValue from './formatWatchValue';

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

		expect(formatWatchValue(memoryViews, createMemory({ elementWordSize: 2 }), 0, 'hex')).toBe('00 0f');
	});

	it('formats single-byte hex values as a padded byte', () => {
		const memoryViews = createMemoryViews();
		memoryViews.uint8[0] = 0x0a;

		expect(formatWatchValue(memoryViews, createMemory({ elementWordSize: 1 }), 0, 'hex')).toBe('0a');
	});

	it.each(['decimal', 'binary', 'hex'] as const)(
		'renders an invalid marker for an out-of-range %s watch index',
		format => {
			const memoryViews = createMemoryViews();

			expect(formatWatchValue(memoryViews, createMemory({ elementWordSize: 4 }), 2, format)).toBe('?');
		}
	);
});
