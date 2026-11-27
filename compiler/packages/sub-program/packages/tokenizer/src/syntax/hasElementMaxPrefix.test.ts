import { describe, expect, it } from 'vitest';

import hasElementMaxPrefix from './hasElementMaxPrefix';

describe('hasElementMaxPrefix', () => {
	it('matches element max function-style syntax', () => {
		expect(hasElementMaxPrefix('max(value)')).toBe(true);
	});

	it('returns false for pointee form', () => {
		expect(hasElementMaxPrefix('max(*value)')).toBe(false);
	});

	it('returns false for plain identifiers', () => {
		expect(hasElementMaxPrefix('value')).toBe(false);
	});
});
