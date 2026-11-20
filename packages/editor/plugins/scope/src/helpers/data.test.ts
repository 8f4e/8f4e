import { describe, expect, it } from 'vitest';
import { createScopeDirectiveData } from './data';

describe('scope directive data', () => {
	it.each([
		{ args: ['level', '30'], sampleRate: 30 },
		{ args: ['&level', '0.5'], sampleRate: 0.5 },
		{ args: ['group/module:level', '1000', '-1', '1'], sampleRate: 1000, minValueOverride: -1, maxValueOverride: 1 },
		{ args: ['*pointer', '10', '0', '255'], sampleRate: 10, minValueOverride: 0, maxValueOverride: 255 },
	])('interprets $args', ({ args, ...values }) => {
		expect(createScopeDirectiveData(args, 3)).toEqual({
			memoryId: args[0],
			lineNumber: 3,
			...values,
		});
	});

	it.each([
		[],
		['level'],
		['level', 'memoryRate'],
		['level', '0'],
		['level', '-10'],
		['level', 'Infinity'],
		['level', '1e-9'],
		['level', '1001'],
		['level', '30', '0'],
		['level', '30', '1', '-1'],
		['level', '30', '0', '0'],
		['level', '30', '-1e308', '1e308'],
		['level', '30', 'NaN', '1'],
		['level', '30', '0', '1', '2'],
		['&', '30'],
	])('rejects invalid arguments %j', (...args: string[]) => {
		expect(createScopeDirectiveData(args, 0)).toBeUndefined();
	});
});
