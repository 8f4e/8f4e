import { describe, expect, it } from 'vitest';

import getPointerDepth from './getPointerDepth';

describe('getPointerDepth', () => {
	it('counts trailing pointer markers', () => {
		expect(getPointerDepth('int')).toBe(0);
		expect(getPointerDepth('int*')).toBe(1);
		expect(getPointerDepth('float**')).toBe(2);
	});

	it('ignores non-trailing asterisks', () => {
		expect(getPointerDepth('in*t')).toBe(0);
	});
});
