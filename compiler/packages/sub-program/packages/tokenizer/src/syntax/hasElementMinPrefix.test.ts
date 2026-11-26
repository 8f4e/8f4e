import { describe, expect, it } from 'vitest';

import hasElementMinPrefix from './hasElementMinPrefix';

describe('hasElementMinPrefix', () => {
	it('matches element min function-style syntax', () => {
		expect(hasElementMinPrefix('min(value)')).toBe(true);
	});

	it('returns false for plain identifiers', () => {
		expect(hasElementMinPrefix('value')).toBe(false);
	});
});
