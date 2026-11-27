import { describe, expect, it } from 'vitest';

import hasElementWordSizePrefix from './hasElementWordSizePrefix';

describe('hasElementWordSizePrefix', () => {
	it('matches element word size function-style syntax', () => {
		expect(hasElementWordSizePrefix('sizeof(value)')).toBe(true);
	});

	it('returns false for pointee form', () => {
		expect(hasElementWordSizePrefix('sizeof(*value)')).toBe(false);
	});

	it('returns false for plain identifiers', () => {
		expect(hasElementWordSizePrefix('value')).toBe(false);
	});
});
