import { describe, expect, it } from 'vitest';

import hasElementCountPrefix from './hasElementCountPrefix';

describe('hasElementCountPrefix', () => {
	it('matches element count function-style syntax', () => {
		expect(hasElementCountPrefix('count(value)')).toBe(true);
	});

	it('returns false for plain identifiers', () => {
		expect(hasElementCountPrefix('value')).toBe(false);
	});
});
