import { describe, expect, it } from 'vitest';

import isIntermodularElementMinReference from './isIntermodularElementMinReference';

describe('isIntermodularElementMinReference', () => {
	it('matches valid inter-modular element min references', () => {
		expect(isIntermodularElementMinReference('min(module:buffer)')).toBe(true);
		expect(isIntermodularElementMinReference('min(sourceModule:data)')).toBe(true);
	});

	it('rejects multi-dot references', () => {
		expect(isIntermodularElementMinReference('min(module:path:to:memory)')).toBe(false);
		expect(isIntermodularElementMinReference('min(mod:a:b)')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularElementMinReference('module.id')).toBe(false); // missing min()
		expect(isIntermodularElementMinReference('min(module)')).toBe(false); // missing colon
		expect(isIntermodularElementMinReference('min(module:)')).toBe(false); // missing memory name
		expect(isIntermodularElementMinReference('min(module id)')).toBe(false); // space
	});

	it('rejects local element min references', () => {
		expect(isIntermodularElementMinReference('min(buffer)')).toBe(false); // local reference
	});
});
