import { describe, expect, it } from 'vitest';

import extractElementMaxBase from './extractElementMaxBase';

describe('extractElementMaxBase', () => {
	it('removes max() wrapper', () => {
		expect(extractElementMaxBase('max(value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractElementMaxBase('value')).toBe('value');
	});
});
