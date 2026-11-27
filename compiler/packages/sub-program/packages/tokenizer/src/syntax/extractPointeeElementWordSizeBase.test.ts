import { describe, expect, it } from 'vitest';

import extractPointeeElementWordSizeBase from './extractPointeeElementWordSizeBase';

describe('extractPointeeElementWordSizeBase', () => {
	it('removes pointee sizeof() wrapper', () => {
		expect(extractPointeeElementWordSizeBase('sizeof(*value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractPointeeElementWordSizeBase('value')).toBe('value');
	});

	it('does not strip plain sizeof() form', () => {
		expect(extractPointeeElementWordSizeBase('sizeof(value)')).toBe('sizeof(value)');
	});
});
