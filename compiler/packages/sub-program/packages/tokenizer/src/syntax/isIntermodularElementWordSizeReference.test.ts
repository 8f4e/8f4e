import { describe, expect, it } from 'vitest';

import isIntermodularElementWordSizeReference from './isIntermodularElementWordSizeReference';

describe('isIntermodularElementWordSizeReference', () => {
	it('matches valid inter-modular element word size references', () => {
		expect(isIntermodularElementWordSizeReference('sizeof(module:buffer)')).toBe(true);
		expect(isIntermodularElementWordSizeReference('sizeof(sourceModule:data)')).toBe(true);
	});

	it('rejects multi-dot references', () => {
		expect(isIntermodularElementWordSizeReference('sizeof(module:path:to:memory)')).toBe(false);
		expect(isIntermodularElementWordSizeReference('sizeof(mod:a:b)')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularElementWordSizeReference('module.id')).toBe(false); // missing sizeof()
		expect(isIntermodularElementWordSizeReference('sizeof(module)')).toBe(false); // missing colon
		expect(isIntermodularElementWordSizeReference('sizeof(module:)')).toBe(false); // missing memory name
		expect(isIntermodularElementWordSizeReference('sizeof(module id)')).toBe(false); // space
	});

	it('rejects local element word size references', () => {
		expect(isIntermodularElementWordSizeReference('sizeof(buffer)')).toBe(false); // local reference
	});
});
