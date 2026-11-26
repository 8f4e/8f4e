import { describe, expect, it } from 'vitest';

import extractElementWordSizeBase from './extractElementWordSizeBase';

describe('extractElementWordSizeBase', () => {
	it('removes sizeof() wrapper', () => {
		expect(extractElementWordSizeBase('sizeof(value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractElementWordSizeBase('value')).toBe('value');
	});
});
