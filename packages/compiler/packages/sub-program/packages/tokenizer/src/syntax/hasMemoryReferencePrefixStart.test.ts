import { describe, expect, it } from 'vitest';

import hasMemoryReferencePrefixStart from './hasMemoryReferencePrefixStart';

describe('hasMemoryReferencePrefixStart', () => {
	it('matches when & is at the start', () => {
		expect(hasMemoryReferencePrefixStart('&value')).toBe(true);
	});

	it('returns false for end queries', () => {
		expect(hasMemoryReferencePrefixStart('end(value)')).toBe(false);
	});

	it('returns false for plain identifiers', () => {
		expect(hasMemoryReferencePrefixStart('value')).toBe(false);
	});
});
