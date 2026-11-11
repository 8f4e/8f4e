import { describe, expect, it } from 'vitest';
import check from './isIntermodularModuleReference';

describe('isIntermodularModuleReference', () => {
	it.each(['&module:', '&notesMux2:'])('recognizes the start reference %s', value => expect(check(value)).toBe(true));
	it.each(['end(module:)', 'module:&', '&module:memory', '&module::', '&module:memory&'])(
		'rejects %s as a start reference',
		value => expect(check(value)).toBe(false)
	);
});
