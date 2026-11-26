import { describe, expect, it } from 'vitest';

import extractElementMinBase from './extractElementMinBase';

describe('extractElementMinBase', () => {
	it('removes min() wrapper', () => {
		expect(extractElementMinBase('min(value)')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractElementMinBase('value')).toBe('value');
	});
});
