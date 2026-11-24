import type { StackItem } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { formatKnownStackValue } from './formatKnownStackValue';

function float32(value: number): StackItem {
	return { kind: 'value', valueType: 'float', knownValue: Math.fround(value) };
}

describe('formatKnownStackValue', () => {
	it.each([
		[3.2, '3.2'],
		[3.1, '3.1'],
		[Math.PI, '3.1415927'],
	])('formats the shortest decimal that round-trips to float32 %s', (value, expected) => {
		expect(formatKnownStackValue(float32(value))).toBe(expected);
	});

	it('preserves float64 precision', () => {
		expect(formatKnownStackValue({ kind: 'value', valueType: 'float64', knownValue: 3.141592653589793 })).toBe(
			'3.141592653589793'
		);
	});
});
