import { describe, expect, test } from 'vitest';

import writeDefaultValue from './writeDefaultValue';

describe('writeDefaultValue', () => {
	test('writes signed and unsigned narrow integer defaults', () => {
		const bytes = new Uint8Array(4);
		const view = new DataView(bytes.buffer);

		writeDefaultValue(view, { isInteger: true, isUnsigned: false, elementWordSize: 1 }, 0, -1.7);
		writeDefaultValue(view, { isInteger: true, isUnsigned: true, elementWordSize: 2 }, 1, 258.9);

		expect(Array.from(bytes)).toEqual([255, 2, 1, 0]);
	});

	test('writes 32-bit integer and float defaults', () => {
		const bytes = new Uint8Array(8);
		const view = new DataView(bytes.buffer);

		writeDefaultValue(view, { isInteger: true, isUnsigned: false, elementWordSize: 4 }, 0, 2.9);
		writeDefaultValue(view, { isInteger: false, isUnsigned: false, elementWordSize: 4 }, 4, 1.5);

		expect(view.getInt32(0, true)).toBe(2);
		expect(view.getFloat32(4, true)).toBe(1.5);
	});

	test('writes 64-bit float defaults', () => {
		const bytes = new Uint8Array(8);
		const view = new DataView(bytes.buffer);

		writeDefaultValue(view, { isInteger: false, isUnsigned: false, elementWordSize: 8 }, 0, Math.PI);

		expect(view.getFloat64(0, true)).toBe(Math.PI);
	});
});
