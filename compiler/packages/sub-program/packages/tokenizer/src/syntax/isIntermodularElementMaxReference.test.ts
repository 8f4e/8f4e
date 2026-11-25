import { describe, expect, it } from 'vitest';

import isIntermodularElementMaxReference from './isIntermodularElementMaxReference';

describe('isIntermodularElementMaxReference', () => {
	it('matches valid inter-modular element max references', () => {
		expect(isIntermodularElementMaxReference('max(module:buffer)')).toBe(true);
		expect(isIntermodularElementMaxReference('max(sourceModule:data)')).toBe(true);
	});

	it('rejects multi-dot references', () => {
		expect(isIntermodularElementMaxReference('max(module:path:to:memory)')).toBe(false);
		expect(isIntermodularElementMaxReference('max(mod:a:b)')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularElementMaxReference('module.id')).toBe(false); // missing max()
		expect(isIntermodularElementMaxReference('max(module)')).toBe(false); // missing colon
		expect(isIntermodularElementMaxReference('max(module:)')).toBe(false); // missing memory name
		expect(isIntermodularElementMaxReference('max(module id)')).toBe(false); // space
	});

	it('rejects local element max references', () => {
		expect(isIntermodularElementMaxReference('max(buffer)')).toBe(false); // local reference
	});
});
