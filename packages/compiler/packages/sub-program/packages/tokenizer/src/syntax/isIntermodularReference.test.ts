import { describe, expect, it } from 'vitest';

import isIntermodularReference from './isIntermodularReference';

describe('isIntermodularReference', () => {
	it('matches valid start-address intermodular references', () => {
		expect(isIntermodularReference('&module:id')).toBe(true);
		expect(isIntermodularReference('&notesMux2:out')).toBe(true);
	});

	it('matches valid end-address intermodular references', () => {
		expect(isIntermodularReference('notesMux2:buffer&')).toBe(true);
		expect(isIntermodularReference('module:memory&')).toBe(true);
	});

	it('rejects multi-separator references', () => {
		expect(isIntermodularReference('&notesMux2:out:notes')).toBe(false);
		expect(isIntermodularReference('&module:path:to:memory')).toBe(false);
		expect(isIntermodularReference('notesMux2:out:notes&')).toBe(false);
		expect(isIntermodularReference('module:path:to:memory&')).toBe(false);
	});

	it('rejects invalid references', () => {
		expect(isIntermodularReference('module:id')).toBe(false); // missing & or trailing &
		expect(isIntermodularReference('&module')).toBe(false); // missing colon
		expect(isIntermodularReference('&module:')).toBe(false); // module-base reference, not memory
		expect(isIntermodularReference('&notesMux2:')).toBe(false); // missing memory name
		expect(isIntermodularReference('notesMux2:out')).toBe(false); // missing & or trailing &
		expect(isIntermodularReference('&module:id&&')).toBe(false); // double ampersand
		expect(isIntermodularReference('&module id')).toBe(false); // space
		expect(isIntermodularReference('&module:memory&')).toBe(false); // old syntax (both & prefix and & suffix)
	});
});
