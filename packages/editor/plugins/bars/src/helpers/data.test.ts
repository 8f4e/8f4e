import { describe, expect, it } from 'vitest';
import { createBarsDirectiveData } from './data';

describe('bars directive data', () => {
	it.each([
		{ args: ['bins', 'arrayLength'], length: 'arrayLength' },
		{ args: ['bins', '128'], length: 128 },
		{ args: ['bins', '64', '0', '1'], length: 64, minValueOverride: 0, maxValueOverride: 1 },
	])('interprets element counts and ranges for $args', ({ args, ...values }) => {
		expect(createBarsDirectiveData(args, 2)).toEqual({ startAddressMemoryId: 'bins', lineNumber: 2, ...values });
	});

	it.each([['bins'], ['*bins', '64'], ['bins', '64', '0'], ['bins', '64', '0', '1', 'extra']])(
		'rejects debugger expressions, missing arguments, and extra arguments: %s',
		(...args) => {
			expect(createBarsDirectiveData(args, 0)).toBeUndefined();
		}
	);
});
