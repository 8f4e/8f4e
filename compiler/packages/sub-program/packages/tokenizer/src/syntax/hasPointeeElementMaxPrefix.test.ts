import { describe, expect, it } from 'vitest';

import hasPointeeElementMaxPrefix from './hasPointeeElementMaxPrefix';

describe('hasPointeeElementMaxPrefix', () => {
	it('matches pointee element max function-style syntax', () => {
		expect(hasPointeeElementMaxPrefix('max(*value)')).toBe(true);
	});

	it('returns false for plain max() form', () => {
		expect(hasPointeeElementMaxPrefix('max(value)')).toBe(false);
	});

	it('returns false for plain identifiers', () => {
		expect(hasPointeeElementMaxPrefix('value')).toBe(false);
	});
});
