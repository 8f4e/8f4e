import { describe, expect, it } from 'vitest';

import isIntermodularElementCountReference from './isIntermodularElementCountReference';

describe('isIntermodularElementCountReference', () => {
	it('matches valid inter-modular element count references', () => {
		expect(isIntermodularElementCountReference('count(module:buffer)')).toBe(true);
		expect(isIntermodularElementCountReference('count(sourceModule:data)')).toBe(true);
	});

	it('rejects multi-dot references', () => {
		expect(isIntermodularElementCountReference('count(module:path:to:memory)')).toBe(false);
		expect(isIntermodularElementCountReference('count(mod:a:b)')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularElementCountReference('module.id')).toBe(false); // missing count()
		expect(isIntermodularElementCountReference('count(module)')).toBe(false); // missing colon
		expect(isIntermodularElementCountReference('count(module:)')).toBe(false); // missing memory name
		expect(isIntermodularElementCountReference('count(module id)')).toBe(false); // space
	});

	it('rejects local element count references', () => {
		expect(isIntermodularElementCountReference('count(buffer)')).toBe(false); // local reference
	});
});
