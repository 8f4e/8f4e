import { describe, expect, it } from 'vitest';

import extractPointeeElementMaxBase from './extractPointeeElementMaxBase';

describe('extractPointeeElementMaxBase', () => {
	it('removes pointee max() wrapper', () => {
		expect(extractPointeeElementMaxBase('max(*value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractPointeeElementMaxBase('value')).toBe('value');
	});

	it('does not strip plain max() form', () => {
		expect(extractPointeeElementMaxBase('max(value)')).toBe('max(value)');
	});
});
