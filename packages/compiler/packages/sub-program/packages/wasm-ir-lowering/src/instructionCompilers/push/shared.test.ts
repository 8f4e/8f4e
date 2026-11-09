import { describe, expect, it } from 'vitest';
import { kindToStackItem, resolveArgumentValueKind } from './shared';

describe('push shared helpers', () => {
	it('resolves value kinds correctly', () => {
		expect(resolveArgumentValueKind({ isInteger: true })).toBe('int32');
		expect(resolveArgumentValueKind({ isInteger: false })).toBe('float32');
		expect(resolveArgumentValueKind({ isInteger: false, isFloat64: true })).toBe('float64');
	});

	it('creates stack items with expected shape', () => {
		expect(kindToStackItem('int32', { isNonZero: true })).toEqual({ kind: 'value', valueType: 'int', isNonZero: true });
		expect(kindToStackItem('float64', { isNonZero: false })).toEqual({
			kind: 'value',
			valueType: 'float64',
			isNonZero: false,
		});
	});
});
