import { describe, expect, it } from 'vitest';
import { createButtonDirectiveData } from './data';

describe('button directive arguments', () => {
	it.each([
		{ args: ['&gate'], offValue: 0, onValue: 1 },
		{ args: ['&gate', '10', '100'], offValue: 10, onValue: 100 },
		{ args: ['&gate', '0.5', '0'], offValue: 0.5, onValue: 0 },
	])('reads values from $args', ({ args, offValue, onValue }) => {
		expect(createButtonDirectiveData(args, 7)).toEqual({ id: '&gate', lineNumber: 7, offValue, onValue });
	});
	it.each([[], ['gate'], ['&gate', 'invalid'], ['&gate', '0', 'invalid'], ['&gate', '0', '1', '2']])(
		'rejects invalid arguments %j',
		(...args) => {
			expect(createButtonDirectiveData(args, 0)).toBeUndefined();
		}
	);
});
