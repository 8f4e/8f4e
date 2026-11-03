import { describe, expect, it } from 'vitest';
import { createPlotDirectiveData } from './data';

describe('plot directive data', () => {
	it.each([
		{ args: ['buffer', 'arrayLength'], length: 'arrayLength' },
		{ args: ['buffer', '128'], length: 128 },
		{
			args: ['buffer', 'arrayLength', '-10', '10'],
			length: 'arrayLength',
			minValueOverride: -10,
			maxValueOverride: 10,
		},
	])('interprets element counts and ranges for $args', ({ args, ...values }) => {
		expect(createPlotDirectiveData(args, 3)).toEqual({ startAddressMemoryId: 'buffer', lineNumber: 3, ...values });
	});

	it.each([['buffer'], ['buffer', '-1', '1']])('rejects a missing count or incomplete range: %s', (...args) => {
		expect(createPlotDirectiveData(args, 0)).toBeUndefined();
	});
});
