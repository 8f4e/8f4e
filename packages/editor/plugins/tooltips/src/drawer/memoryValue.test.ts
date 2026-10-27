import type { MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it } from 'vitest';
import { formatMemoryValue } from './memoryValue';

describe('live memory value formatting', () => {
	it.each([
		{ view: 'int8', size: 1, unsigned: false, integer: true, value: -12, expected: '-12' },
		{ view: 'uint8', size: 1, unsigned: true, integer: true, value: 255, expected: '255' },
		{ view: 'int16', size: 2, unsigned: false, integer: true, value: -1234, expected: '-1234' },
		{ view: 'uint16', size: 2, unsigned: true, integer: true, value: 65535, expected: '65535' },
		{ view: 'int32', size: 4, unsigned: false, integer: true, value: -123456, expected: '-123456' },
		{ view: 'float32', size: 4, unsigned: false, integer: false, value: 3.25, expected: '3.2500' },
		{ view: 'float64', size: 8, unsigned: false, integer: false, value: Math.PI, expected: '3.1416' },
	] as const)('reads $view values at the declaration address', ({ view, size, unsigned, integer, value, expected }) => {
		const buffer = new ArrayBuffer(32);
		const memory: MemoryViews = {
			int8: new Int8Array(buffer),
			int16: new Int16Array(buffer),
			int32: new Int32Array(buffer),
			uint8: new Uint8Array(buffer),
			uint16: new Uint16Array(buffer),
			float32: new Float32Array(buffer),
			float64: new Float64Array(buffer),
		};
		memory[view][8 / size] = value;
		expect(formatMemoryValue(memory, 8, 2, { elementWordSize: size, isInteger: integer, isUnsigned: unsigned })).toBe(
			expected
		);
	});
});
