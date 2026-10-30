import { describe, expect, it } from 'vitest';

import isIntermodularReferencePattern from './isIntermodularReferencePattern';

describe('isIntermodularReferencePattern', () => {
	it('matches valid start-address intermodular references', () => {
		expect(isIntermodularReferencePattern('&module:id')).toBe(true);
		expect(isIntermodularReferencePattern('&notesMux2:out')).toBe(true);
	});

	it('matches valid end-address intermodular references', () => {
		expect(isIntermodularReferencePattern('notesMux2:buffer&')).toBe(true);
		expect(isIntermodularReferencePattern('module:memory&')).toBe(true);
	});

	it('rejects multi-separator references', () => {
		expect(isIntermodularReferencePattern('&notesMux2:out:notes')).toBe(false);
		expect(isIntermodularReferencePattern('&module:path:to:memory')).toBe(false);
		expect(isIntermodularReferencePattern('notesMux2:out:notes&')).toBe(false);
		expect(isIntermodularReferencePattern('module:path:to:memory&')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularReferencePattern('module:id')).toBe(false); // missing & or trailing &
		expect(isIntermodularReferencePattern('&module')).toBe(false); // missing colon
		expect(isIntermodularReferencePattern('&module:')).toBe(false); // module-base reference, not memory
		expect(isIntermodularReferencePattern('&notesMux2:')).toBe(false); // missing memory name
		expect(isIntermodularReferencePattern('notesMux2:out')).toBe(false); // missing & or trailing &
		expect(isIntermodularReferencePattern('&module:id&&')).toBe(false); // double ampersand
		expect(isIntermodularReferencePattern('&module id')).toBe(false); // space
		expect(isIntermodularReferencePattern('&module:memory&')).toBe(false); // old syntax (both & prefix and & suffix)
	});
});
