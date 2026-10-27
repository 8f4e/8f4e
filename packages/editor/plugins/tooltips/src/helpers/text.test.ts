import { describe, expect, it } from 'vitest';

import { wrapTooltipText } from './text';

describe('tooltip text helpers', () => {
	it('wraps tooltip text to the configured maximum length', () => {
		expect(wrapTooltipText('one two three four', 7)).toEqual(['one two', 'three', 'four']);
	});
});
