import { describe, expect, it } from 'vitest';

import extractElementCountBase from './extractElementCountBase';

describe('extractElementCountBase', () => {
	it('removes count() wrapper', () => {
		expect(extractElementCountBase('count(value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractElementCountBase('value')).toBe('value');
	});
});
