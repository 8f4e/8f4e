import { describe, expect, it } from 'vitest';

import hasPointeeElementWordSizePrefix from './hasPointeeElementWordSizePrefix';

describe('hasPointeeElementWordSizePrefix', () => {
	it('matches pointee element word size function-style syntax', () => {
		expect(hasPointeeElementWordSizePrefix('sizeof(*value)')).toBe(true);
	});

	it('returns false for plain sizeof() form', () => {
		expect(hasPointeeElementWordSizePrefix('sizeof(value)')).toBe(false);
	});

	it('returns false for plain identifiers', () => {
		expect(hasPointeeElementWordSizePrefix('value')).toBe(false);
	});
});
