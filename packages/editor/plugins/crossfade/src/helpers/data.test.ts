import { describe, expect, it } from 'vitest';
import { createCrossfadeDirectiveData } from './data';

describe('crossfade directive data', () => {
	it('interprets two memory addresses and preserves the source line', () => {
		expect(createCrossfadeDirectiveData(['&dry', '&wet'], 4)).toEqual({
			leftMemoryId: '&dry',
			rightMemoryId: '&wet',
			lineNumber: 4,
		});
	});

	it.each([['&dry'], ['dry', 'wet']])('rejects arguments without two memory addresses: %s', (...args) => {
		expect(createCrossfadeDirectiveData(args, 0)).toBeUndefined();
	});
});
