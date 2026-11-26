import { describe, expect, it } from 'vitest';

import isInstructionLikeLine from './isInstructionLikeLine';

describe('isInstructionLikeLine', () => {
	it('accepts instruction-shaped lines', () => {
		expect(isInstructionLikeLine('hello')).toBe(true);
		expect(isInstructionLikeLine('add 1 2')).toBe(true);
		expect(isInstructionLikeLine('hello 10')).toBe(true);
	});

	it('rejects comment-only lines', () => {
		expect(isInstructionLikeLine('; comment')).toBe(false);
	});
});
