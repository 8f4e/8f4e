import { describe, expect, it } from 'vitest';
import { createCrossfadeDirectiveData } from './data';

describe('crossfade directive data', () => {
	it.each([
		['&dry', '&wet'],
		['dry', 'wet'],
	])('interprets addresses or fixed references: %s %s', (left, right) => {
		expect(createCrossfadeDirectiveData([left, right], 4)).toEqual({
			leftMemoryId: left,
			rightMemoryId: right,
			lineNumber: 4,
		});
	});

	it.each([['&dry'], ['*dry', 'wet']])('rejects invalid sources: %s', (...args) => {
		expect(createCrossfadeDirectiveData(args, 0)).toBeUndefined();
	});
});
