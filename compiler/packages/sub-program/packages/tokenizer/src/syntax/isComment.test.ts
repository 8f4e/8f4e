import { describe, expect, it } from 'vitest';

import isComment from './isComment';

describe('isComment', () => {
	it('matches lines starting with semicolon', () => {
		expect(isComment('; comment')).toBe(true);
		expect(isComment('   ; comment')).toBe(true);
	});

	it('returns false for lines starting with hash', () => {
		expect(isComment('# directive')).toBe(false);
		expect(isComment('   # directive')).toBe(false);
	});

	it('returns false for non-comment lines', () => {
		expect(isComment('add 1 2')).toBe(false);
		expect(isComment('hello')).toBe(false);
	});
});
