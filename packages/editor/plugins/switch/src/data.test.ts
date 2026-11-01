import { describe, expect, it } from 'vitest';
import { createSwitchDirectiveData } from './data';

describe('switch directive data', () => {
	it.each([
		{ args: ['&gate'], offValue: 0, onValue: 1 },
		{ args: ['&gate', '10'], offValue: 10, onValue: 1 },
		{ args: ['&gate', '10', '100'], offValue: 10, onValue: 100 },
		{ args: ['&gate', '0.5', '0'], offValue: 0.5, onValue: 0 },
	])('interprets values and preserves the source line for $args', ({ args, ...values }) => {
		expect(createSwitchDirectiveData(args, 5)).toEqual({ id: '&gate', lineNumber: 5, ...values });
	});

	it.each([[], ['gate'], ['&gate', 'invalid', 'invalid']])('rejects invalid arguments: %s', (...args) => {
		expect(createSwitchDirectiveData(args, 0)).toBeUndefined();
	});
});
