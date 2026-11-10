import { describe, expect, it } from 'vitest';
import { resolveArgumentValueKind } from './shared';

describe('push shared helpers', () => {
	it('resolves value kinds correctly', () => {
		expect(resolveArgumentValueKind({ isInteger: true })).toBe('int32');
		expect(resolveArgumentValueKind({ isInteger: false })).toBe('float32');
		expect(resolveArgumentValueKind({ isInteger: false, isFloat64: true })).toBe('float64');
	});
});
