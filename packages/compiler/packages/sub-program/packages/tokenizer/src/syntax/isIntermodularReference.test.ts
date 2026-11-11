import { describe, expect, it } from 'vitest';
import check from './isIntermodularReference';

describe('isIntermodularReference', () => {
	it.each(['&module:memory', '&notesMux2:buffer'])('recognizes the start reference %s', value =>
		expect(check(value)).toBe(true)
	);
	it.each(['end(module:memory)', 'module:memory&', '&module:', '&module::', '&module:memory&'])(
		'rejects %s as a start reference',
		value => expect(check(value)).toBe(false)
	);
});
