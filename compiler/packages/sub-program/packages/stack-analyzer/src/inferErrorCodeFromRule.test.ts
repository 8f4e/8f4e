import { ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import { inferErrorCodeFromRule } from './inferErrorCodeFromRule';

describe('inferErrorCodeFromRule', () => {
	it('returns the correct error code for scalar rules', () => {
		expect(inferErrorCodeFromRule('int')).toBe(ErrorCode.ONLY_INTEGERS);
		expect(inferErrorCodeFromRule('float')).toBe(ErrorCode.ONLY_FLOATS);
		expect(inferErrorCodeFromRule('matching')).toBe(ErrorCode.UNMATCHING_OPERANDS);
	});

	it('returns TYPE_MISMATCH for tuple rules', () => {
		expect(inferErrorCodeFromRule(['int', 'float'])).toBe(ErrorCode.TYPE_MISMATCH);
	});
});
