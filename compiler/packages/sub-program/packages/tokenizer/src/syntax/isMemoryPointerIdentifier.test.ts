import { describe, expect, it } from 'vitest';

import isMemoryPointerIdentifier from './isMemoryPointerIdentifier';

describe('isMemoryPointerIdentifier', () => {
	it('matches pointer identifiers', () => {
		expect(isMemoryPointerIdentifier('*value')).toBe(true);
	});

	it('returns false for non-pointers', () => {
		expect(isMemoryPointerIdentifier('value')).toBe(false);
	});
});
