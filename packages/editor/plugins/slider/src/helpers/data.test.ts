import { describe, expect, it } from 'vitest';
import { createSliderDirectiveData } from './data';

describe('slider arguments', () => {
	it.each([
		{ args: ['&gain'], min: undefined, max: undefined, step: undefined },
		{ args: ['&gain', '0'], min: 0, max: undefined, step: undefined },
		{ args: ['&gain', '-100', '100', '5'], min: -100, max: 100, step: 5 },
		{ args: ['&group:gain', '0', '1', '0.01'], min: 0, max: 1, step: 0.01 },
	])('reads memory, range, and step from $args', ({ args, min, max, step }) => {
		expect(createSliderDirectiveData(args, 7)).toEqual({ memoryId: args[0], sourceLineIndex: 7, min, max, step });
	});
	it.each([
		[],
		['gain'],
		['&gain', 'invalid'],
		['&gain', '0', 'invalid'],
		['&gain', '0', '1', '0'],
		['&gain', '0', '1', '-1'],
		['&gain', '0', '1', 'invalid'],
		['&gain', '0', '1', '0.1', 'extra'],
	])('rejects invalid arguments %j', (...args) => {
		expect(createSliderDirectiveData(args, 0)).toBeUndefined();
	});
});
